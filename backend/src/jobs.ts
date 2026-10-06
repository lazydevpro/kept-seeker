import type { AppEnv, Job, PushJob } from "./types";
import { id } from "./lib/http";
import { NATIVE_SOL_MINT, rpcUrl, SOL_DECIMALS } from "./lib/solana";

/**
 * How long a signature may go unseen before it is presumed never to have landed.
 *
 * A Solana transaction is only valid for ~150 blocks (60–90 seconds) after its
 * blockhash. Past that it can never be included, so "not found" stops meaning
 * "not yet" and starts meaning "never". Ten minutes is several times that
 * window, which leaves room for a lagging RPC without leaving a purchase that
 * failed to land sitting at "pending" forever.
 */
const NEVER_LANDED_MS = 10 * 60_000;

interface RpcTransaction {
  blockTime: number | null;
  meta: {
    err: unknown;
    /** Lamports, paid by the first account key. */
    fee?: number;
    /** Lamports per account, in `accountKeys` order. */
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: {
      mint: string;
      owner?: string;
      uiTokenAmount: { amount: string; decimals?: number };
    }[];
    postTokenBalances?: {
      mint: string;
      owner?: string;
      uiTokenAmount: { amount: string; decimals?: number };
    }[];
  } | null;
  transaction: {
    message: {
      accountKeys: Array<string | { pubkey: string }>;
      instructions?: Array<{ program?: string; parsed?: unknown }>;
    };
    signatures: string[];
  };
}

async function rpc<T>(
  env: AppEnv,
  method: string,
  params: unknown[],
): Promise<T> {
  const response = await fetch(rpcUrl(env), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params,
    }),
  });
  if (!response.ok) throw new Error(`Solana RPC returned ${response.status}`);
  const payload = (await response.json()) as {
    result?: T;
    error?: { message: string };
  };
  if (payload.error) throw new Error(payload.error.message);
  return payload.result as T;
}

type TokenBalances = NonNullable<RpcTransaction["meta"]>["postTokenBalances"];

/**
 * What a wallet actually received in a confirmed transaction, as the balance
 * delta for one mint, plus that mint's decimals.
 *
 * This is the single source of truth for holdings. The submit-time
 * `amount_base_units` is the router's estimate and is a literal '0' for sandbox,
 * so it must never be used for quantities. Shared by verification and by the
 * nightly backfill so the two cannot drift apart.
 *
 * SOL is the exception: it arrives as lamports, not as a token (see
 * `NATIVE_SOL_MINT`). Its delta is the wallet's lamport change plus the fee, when
 * the wallet paid it — a purchase of 0.1 SOL reads as 0.1, not 0.1 less the fee.
 * Anything else the wallet spends in SOL inside the same transaction (a tip, a
 * new account's rent) still comes off, so the count errs low, never high. Token
 * balances of wrapped SOL are added on top, for the rare wallet that keeps it
 * wrapped.
 */
export function receivedAmount(
  transaction: RpcTransaction,
  owner: string,
  mint: string,
): { amount: bigint; decimals: number | null } {
  const held = (balances: TokenBalances) =>
    (balances ?? [])
      .filter((balance) => balance.owner === owner && balance.mint === mint)
      .reduce(
        (total, balance) => total + BigInt(balance.uiTokenAmount.amount),
        0n,
      );

  const decimals = (transaction.meta?.postTokenBalances ?? []).find(
    (balance) => balance.owner === owner && balance.mint === mint,
  )?.uiTokenAmount.decimals;

  const tokens =
    held(transaction.meta?.postTokenBalances) -
    held(transaction.meta?.preTokenBalances);

  if (mint !== NATIVE_SOL_MINT)
    return { amount: tokens, decimals: decimals ?? null };

  const index = transaction.transaction.message.accountKeys.findIndex(
    (key) => (typeof key === "string" ? key : key.pubkey) === owner,
  );
  const pre = transaction.meta?.preBalances?.[index];
  const post = transaction.meta?.postBalances?.[index];
  const lamports =
    index < 0 || pre == null || post == null
      ? 0n
      : BigInt(post) -
        BigInt(pre) +
        // The fee payer is always the first key. Under a gasless route someone else
        // pays, and nothing is added back.
        (index === 0 ? BigInt(transaction.meta?.fee ?? 0) : 0n);
  return { amount: tokens + lamports, decimals: SOL_DECIMALS };
}

/**
 * Fills holdings columns for a contribution verified before migration 0006.
 * Touches only those columns — status and timestamps are already settled — and
 * stamps `holdings_checked_at` either way so a transaction the RPC can no longer
 * serve is not re-queued every night.
 */
async function backfillHoldings(env: AppEnv, contributionId: string) {
  const contribution = await env.DB.prepare(
    `SELECT id, signature, wallet_address, asset_mint, direction FROM contributions
     WHERE id = ? AND status = 'verified' AND execution_mode = 'live'
       AND holdings_checked_at IS NULL`,
  )
    .bind(contributionId)
    .first();
  if (!contribution) return;

  const stamp = async (amount: string | null, decimals: number | null) =>
    env.DB.prepare(
      `UPDATE contributions
       SET verified_amount_base_units = COALESCE(?, verified_amount_base_units),
           asset_decimals = COALESCE(?, asset_decimals),
           holdings_checked_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
      .bind(amount, decimals, contributionId)
      .run();

  let transaction: RpcTransaction | null = null;
  try {
    transaction = await rpc<RpcTransaction | null>(env, "getTransaction", [
      contribution.signature,
      {
        commitment: "confirmed",
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
      },
    ]);
  } catch {
    // Pruned or unavailable. Give up on this row rather than retry nightly.
    await stamp(null, null);
    return;
  }
  if (!transaction) {
    await stamp(null, null);
    return;
  }

  const { amount, decimals } = receivedAmount(
    transaction,
    String(contribution.wallet_address),
    String(contribution.asset_mint),
  );
  // Same sign convention as verification: magnitude positive, direction carries
  // the sign. No sell can reach here today — every one is stamped
  // `holdings_checked_at` on verify — but a column that means two different
  // things depending on which function wrote it is a trap worth not setting.
  const magnitude =
    String(contribution.direction) === "sell" ? -amount : amount;
  await stamp(magnitude.toString(), decimals);
}

/**
 * Queues a bounded batch of pre-0006 contributions for backfill. Called from the
 * daily cron; the bound keeps one night's work small and the `holdings_checked_at`
 * stamp means the backlog drains rather than repeats.
 */
export async function queueHoldingsBackfill(env: AppEnv, limit = 100) {
  const pending = await env.DB.prepare(
    `SELECT id FROM contributions
     WHERE status = 'verified' AND execution_mode = 'live' AND holdings_checked_at IS NULL
     ORDER BY created_at ASC LIMIT ?`,
  )
    .bind(limit)
    .all();
  for (const row of pending.results as Array<{ id: string }>) {
    await env.JOBS.send({
      kind: "backfill_holdings",
      contributionId: row.id,
    } satisfies Job);
  }
  return pending.results.length;
}

/**
 * Re-queues verification for anything still pending after two minutes.
 *
 * Verification is queued once, when the signature is submitted, and a queue
 * message gives up after its retries — about a minute of backoff. An RPC outage
 * or a slow confirmation that outlasted that minute used to leave the row at
 * "pending" for good: the money spent, the week never kept, and the app's
 * settlement banner quietly giving up. Every five minutes this picks those rows
 * back up; `verifyContribution` settles them either way, including rejecting a
 * transaction that never landed.
 *
 * Bounded per run so a backlog drains over several runs rather than all at once.
 */
export async function sweepPendingContributions(env: AppEnv, limit = 100) {
  const stuck = await env.DB.prepare(
    `SELECT id FROM contributions
     WHERE status = 'pending' AND created_at <= datetime('now', '-2 minutes')
     ORDER BY created_at ASC LIMIT ?`,
  )
    .bind(limit)
    .all<{ id: string }>();
  for (const row of stuck.results) {
    await env.JOBS.send({
      kind: "verify_contribution",
      contributionId: row.id,
    } satisfies Job);
  }
  return stuck.results.length;
}

async function verifyContribution(env: AppEnv, contributionId: string) {
  const contribution = await env.DB.prepare(
    "SELECT * FROM contributions WHERE id = ? AND status = ?",
  )
    .bind(contributionId, "pending")
    .first();
  if (!contribution) return;

  /*
   * A demo purchase (see `demo` in routes/trades.ts) never touched a chain, so there
   * is nothing to read back: it settles as exactly what was quoted. Only a local
   * server can create one, and only a local server will settle one.
   */
  if (String(contribution.execution_mode) === "demo") {
    if (env.ENVIRONMENT !== "local") {
      await env.DB.prepare(
        "UPDATE contributions SET status = 'rejected', failure_reason = ? WHERE id = ? AND status = 'pending'",
      )
        .bind("Demo purchases only settle on a local server.", contributionId)
        .run();
      return;
    }
    // From here it reads as an ordinary purchase: the portfolio, the widget and the
    // home screen count only live ones. Its `demo` signature still says what it was.
    await env.DB.prepare(
      "UPDATE contributions SET execution_mode = 'live' WHERE id = ? AND status = 'pending'",
    )
      .bind(contributionId)
      .run();
    await settle(env, contribution, contributionId, {
      occurredAt: new Date().toISOString(),
      moved: BigInt(String(contribution.amount_base_units ?? "0")),
      decimals:
        contribution.asset_decimals == null
          ? null
          : Number(contribution.asset_decimals),
      selling: false,
    });
    return;
  }

  const transaction = await rpc<RpcTransaction | null>(env, "getTransaction", [
    contribution.signature,
    {
      commitment: "confirmed",
      encoding: "jsonParsed",
      maxSupportedTransactionVersion: 0,
    },
  ]);
  if (!transaction) {
    // SQLite's CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS", in UTC, with no zone.
    const age =
      Date.now() -
      Date.parse(`${String(contribution.created_at).replace(" ", "T")}Z`);
    if (age > NEVER_LANDED_MS) {
      await env.DB.prepare(
        "UPDATE contributions SET status = 'rejected', failure_reason = ? WHERE id = ? AND status = 'pending'",
      )
        .bind(
          "The transaction never confirmed on-chain, so nothing was bought or counted.",
          contributionId,
        )
        .run();
      return;
    }
    throw new Error("Transaction is not confirmed yet");
  }

  const keys = transaction.transaction.message.accountKeys.map((key) =>
    typeof key === "string" ? key : key.pubkey,
  );
  const sandbox = String(contribution.execution_mode) === "sandbox";
  const memoMatched = (transaction.transaction.message.instructions ?? []).some(
    (instruction) =>
      instruction.program === "spl-memo" &&
      instruction.parsed === String(contribution.verification_reference),
  );
  const { amount: tokenAmount, decimals } = receivedAmount(
    transaction,
    String(contribution.wallet_address),
    String(contribution.asset_mint),
  );

  /*
   * A sell moves the asset the other way, so the buy-side predicate rejects every
   * one of them. The chain is still the authority — it just has to be asked the
   * mirrored question: did this wallet's balance of that mint go DOWN.
   *
   * The magnitude is stored positive. `direction` carries the sign, and the
   * nightly holdings backfill writes whatever delta it reads, so a negative in
   * this column would mean two different things depending on which code wrote it.
   */
  const selling = String(contribution.direction) === "sell";
  const moved = selling ? -tokenAmount : tokenAmount;

  const valid =
    transaction.meta?.err == null &&
    transaction.transaction.signatures.includes(
      String(contribution.signature),
    ) &&
    keys.includes(String(contribution.wallet_address)) &&
    (sandbox
      ? memoMatched && Boolean(contribution.verification_reference)
      : Boolean(contribution.asset_mint) && moved > 0n);
  if (!valid) {
    await env.DB.prepare(
      "UPDATE contributions SET status = 'rejected', failure_reason = ? WHERE id = ? AND status = 'pending'",
    )
      .bind(
        sandbox
          ? "The devnet rehearsal did not contain the expected signed KEPT memo."
          : selling
            ? "Transaction failed or did not reduce the linked wallet’s balance of that asset."
            : "Transaction failed or did not increase the linked wallet’s selected asset balance.",
        contributionId,
      )
      .run();
    return;
  }

  const occurredAt = transaction.blockTime
    ? new Date(transaction.blockTime * 1000).toISOString()
    : new Date().toISOString();

  await settle(env, contribution, contributionId, {
    occurredAt,
    moved,
    decimals: decimals ?? null,
    selling,
  });
}

/** Marks a checked contribution verified, then does everything keeping a promise sets off. */
async function settle(
  env: AppEnv,
  contribution: Record<string, unknown>,
  contributionId: string,
  {
    occurredAt,
    moved,
    decimals,
    selling,
  }: {
    occurredAt: string;
    moved: bigint;
    decimals: number | null;
    selling: boolean;
  },
) {
  /*
   * `AND status = 'pending'` makes this the claim. The sweeper re-queues rows
   * that look stuck, so the same contribution can be verified by two consumers
   * at once — and both used to go on to post "Kept this week's promise" to every
   * circle. Whichever write lands second changes nothing and stops here.
   */
  const claimed = await env.DB.prepare(
    `UPDATE contributions
     SET status = 'verified', verified_at = CURRENT_TIMESTAMP, occurred_at = ?,
         verified_amount_base_units = ?, asset_decimals = ?,
         holdings_checked_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`,
  )
    .bind(occurredAt, moved.toString(), decimals ?? null, contributionId)
    .run();
  if (!claimed.meta.changes) return;

  /*
   * Everything below is the social half, and a sell gets none of it.
   *
   * Keeping a promise means putting money in. Taking money out is not an
   * achievement, must not close a week, and is nobody else's business — the
   * circle sees progress, and a disposal is not progress. The position and the
   * portfolio are already updated above, which is the whole effect a sell has.
   */
  if (selling) return;

  if (contribution.goal_id) {
    const promise = await env.DB.prepare(
      "SELECT id FROM weekly_promises WHERE goal_id = ? AND user_id = ? AND completed_at IS NULL ORDER BY week_start DESC LIMIT 1",
    )
      .bind(contribution.goal_id, contribution.user_id)
      .first();
    if (promise) {
      await env.DB.prepare(
        "UPDATE weekly_promises SET completed_at = ?, contribution_id = ? WHERE id = ?",
      )
        .bind(occurredAt, contributionId, promise.id)
        .run();
    }
  }

  const circles = await env.DB.prepare(
    "SELECT circle_id FROM circle_members WHERE user_id = ?",
  )
    .bind(contribution.user_id)
    .all<{ circle_id: string }>();
  for (const circle of circles.results) {
    const postId = id("post");
    await env.DB.prepare(
      "INSERT INTO activity_posts (id, circle_id, user_id, kind, body, contribution_id) VALUES (?, ?, ?, 'promise_kept', ?, ?)",
    )
      .bind(
        postId,
        circle.circle_id,
        contribution.user_id,
        "Kept this week’s promise",
        contributionId,
      )
      .run();
    const room = env.CIRCLE_ROOMS.get(
      env.CIRCLE_ROOMS.idFromName(circle.circle_id),
    );
    await room.fetch("https://circle.internal/broadcast", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-neon-internal": env.BETTER_AUTH_SECRET,
      },
      body: JSON.stringify({ type: "post.created", postId }),
    });
    await env.JOBS.send({ kind: "generate_share_card", postId } satisfies Job);
  }
}

function escapeXml(value: string) {
  return value.replace(
    /[<>&'\"]/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[character]!,
  );
}

async function generateShareCard(env: AppEnv, postId: string) {
  const post = await env.DB.prepare(
    "SELECT ap.id, ap.kind, ap.body, p.display_name FROM activity_posts ap JOIN profiles p ON p.user_id = ap.user_id WHERE ap.id = ?",
  )
    .bind(postId)
    .first();
  if (!post) return;
  await env.DB.prepare(
    "INSERT INTO job_events (id, kind, entity_id, status, detail) VALUES (?, 'generate_share_card', ?, 'ready', ?)",
  )
    .bind(id("job"), postId, String(post.display_name))
    .run();
}

/** Expo rejects a push request carrying more than 100 messages. */
const EXPO_PUSH_BATCH = 100;

/** Users per queued reminder message, to stay well inside the payload limit. */
const REMINDER_FANOUT = 500;

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

async function sendPush(env: AppEnv, job: PushJob) {
  const placeholders = job.userIds.map(() => "?").join(",");
  if (!placeholders) return;
  const tokens = await env.DB.prepare(
    `SELECT token FROM push_tokens WHERE enabled = 1 AND user_id IN (${placeholders})`,
  )
    .bind(...job.userIds)
    .all<{ token: string }>();
  if (!tokens.results.length) return;

  const all = tokens.results.map(({ token }) => token);
  const dead: string[] = [];

  for (let start = 0; start < all.length; start += EXPO_PUSH_BATCH) {
    const chunk = all.slice(start, start + EXPO_PUSH_BATCH);
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.EXPO_ACCESS_TOKEN
          ? { authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(
        chunk.map((token) => ({
          to: token,
          sound: "default",
          title: job.title,
          body: job.body,
          data: job.data,
        })),
      ),
    });
    if (!response.ok)
      throw new Error(`Expo push service returned ${response.status}`);

    // Expo answers 200 even when individual messages fail, so the per-ticket
    // statuses are the only place a dead token shows up. Left unread, an
    // uninstalled device stays in the table and is retried every week forever.
    const payload = (await response.json().catch(() => null)) as {
      data?: ExpoTicket[];
    } | null;
    (payload?.data ?? []).forEach((ticket, index) => {
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
      ) {
        dead.push(chunk[index]);
      }
    });
  }

  if (dead.length) {
    await env.DB.prepare(
      `UPDATE push_tokens SET enabled = 0, updated_at = CURRENT_TIMESTAMP
       WHERE token IN (${dead.map(() => "?").join(",")})`,
    )
      .bind(...dead)
      .run();
  }
}

export async function processQueue(batch: MessageBatch<Job>, env: AppEnv) {
  for (const message of batch.messages) {
    try {
      switch (message.body.kind) {
        case "verify_contribution":
          await verifyContribution(env, message.body.contributionId);
          break;
        case "generate_share_card":
          await generateShareCard(env, message.body.postId);
          break;
        case "send_push":
          await sendPush(env, message.body);
          break;
        case "backfill_holdings":
          await backfillHoldings(env, message.body.contributionId);
          break;
      }
      message.ack();
    } catch (error) {
      console.error("Queue job failed", {
        id: message.id,
        kind: message.body.kind,
        error,
      });
      message.retry({
        delaySeconds: Math.min(300, 10 * Math.max(1, message.attempts)),
      });
    }
  }
}

export async function runWeeklyReminder(env: AppEnv) {
  const activeGoals = await env.DB.prepare(
    `SELECT g.id, g.user_id,
      (SELECT target_cents FROM weekly_promises WHERE goal_id = g.id ORDER BY week_start DESC LIMIT 1) AS target_cents,
      (SELECT due_at FROM weekly_promises WHERE goal_id = g.id ORDER BY week_start DESC LIMIT 1) AS previous_due
     FROM goals g WHERE g.status = 'active'`,
  ).all<{
    id: string;
    user_id: string;
    target_cents: number | null;
    previous_due: string | null;
  }>();
  const now = new Date();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  const weekStart = monday.toISOString().slice(0, 10);
  for (const goal of activeGoals.results) {
    const previousDue = goal.previous_due ? new Date(goal.previous_due) : null;
    const due = new Date(monday);
    due.setUTCDate(
      monday.getUTCDate() +
        (previousDue ? (previousDue.getUTCDay() + 6) % 7 : 6),
    );
    due.setUTCHours(
      previousDue?.getUTCHours() ?? 18,
      previousDue?.getUTCMinutes() ?? 0,
      0,
      0,
    );
    await env.DB.prepare(
      `INSERT OR IGNORE INTO weekly_promises (id, goal_id, user_id, week_start, due_at, target_cents)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id("promise"),
        goal.id,
        goal.user_id,
        weekStart,
        due.toISOString(),
        goal.target_cents,
      )
      .run();
  }
  // Reminders are tracked per promise, not per user. The cron runs nightly and
  // the window is two days wide, so without `reminded_at` the same promise
  // matched twice and every user got the identical nudge on two consecutive
  // nights. A new week creates a new row, so next week reminds again.
  const pending = await env.DB.prepare(
    `SELECT wp.id, wp.user_id FROM weekly_promises wp
     WHERE wp.completed_at IS NULL AND wp.reminded_at IS NULL
       AND wp.due_at > CURRENT_TIMESTAMP AND wp.due_at <= datetime('now', '+2 days')`,
  ).all<{ id: string; user_id: string }>();
  if (!pending.results.length) return;

  const userIds = [...new Set(pending.results.map(({ user_id }) => user_id))];
  // Split so one message can never approach the queue's payload limit.
  for (let start = 0; start < userIds.length; start += REMINDER_FANOUT) {
    await env.JOBS.send({
      kind: "send_push",
      userIds: userIds.slice(start, start + REMINDER_FANOUT),
      title: "Your promise is within reach",
      body: "A small step this week keeps the rhythm alive.",
      data: { route: "/invest" },
    } satisfies Job);
  }

  // Stamped only after the work is safely queued, so a failure here means the
  // reminder is retried tomorrow rather than silently skipped for the week.
  await env.DB.batch(
    pending.results.map(({ id: promiseId }) =>
      env.DB.prepare(
        "UPDATE weekly_promises SET reminded_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).bind(promiseId),
    ),
  );
  return pending.results.length;
}

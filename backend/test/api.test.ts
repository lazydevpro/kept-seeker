import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { Hono } from "hono";
import {
  processQueue,
  receivedAmount,
  runWeeklyReminder,
  sweepPendingContributions,
} from "../src/jobs";
import { LIMITS, rateLimit } from "../src/lib/rate-limit";
import { app } from "../src/app";
import { isNightlyTick } from "../src/index";
import type { AppEnv, Job, Variables } from "../src/types";
import { ed25519 } from "@noble/curves/ed25519.js";
import bs58 from "bs58";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("Neon Reserve API", () => {
  it("reports health without authentication", async () => {
    const response = await SELF.fetch("https://local.test/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it("protects private profile data", async () => {
    const response = await SELF.fetch("https://local.test/v1/me");
    expect(response.status).toBe(401);
  });

  it("creates an anonymous mobile session and profile", async () => {
    const signIn = await SELF.fetch(
      "https://local.test/api/auth/sign-in/anonymous",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "keptseeker://",
        },
        body: "{}",
      },
    );
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get("set-cookie");
    expect(cookie).toContain("better-auth.session_token");
    const profile = await SELF.fetch("https://local.test/v1/me", {
      headers: { cookie: cookie ?? "" },
    });
    expect(profile.status).toBe(200);
    expect(await profile.json()).toMatchObject({
      profile: { privacyMode: "progress_only" },
      wallets: [],
    });
  });

  it("returns the verified Tessera catalog without depending on the xStocks provider", async () => {
    const signIn = await SELF.fetch(
      "https://local.test/api/auth/sign-in/anonymous",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "keptseeker://",
        },
        body: "{}",
      },
    );
    const response = await SELF.fetch(
      "https://local.test/v1/trades/assets?symbols=tOpenAI,tKalshi",
      { headers: { cookie: signIn.headers.get("set-cookie") ?? "" } },
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { assets: unknown[] };
    expect(payload.assets).toMatchObject([
      {
        symbol: "tOpenAI",
        provider: "tessera",
        instrument: "loan_participation",
        mint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
        transferFeeBps: 20,
      },
      {
        symbol: "tKalshi",
        provider: "tessera",
        instrument: "loan_participation",
        mint: "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ",
        transferFeeBps: 20,
      },
    ]);
  });

  /**
   * The invariant the whole product rests on: a circle is private to its
   * members. Membership is the only gate on who can read a circle, its roster
   * or its feed, so it is worth a test rather than a careful reading.
   */
  it("keeps a circle and its feed private to its members", async () => {
    const signIn = async () => {
      const response = await SELF.fetch(
        "https://local.test/api/auth/sign-in/anonymous",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "keptseeker://",
          },
          body: "{}",
        },
      );
      return response.headers.get("set-cookie") ?? "";
    };

    const owner = await signIn();
    const stranger = await signIn();
    expect(owner).not.toBe(stranger);

    const created = await SELF.fetch("https://local.test/v1/circles", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner },
      body: JSON.stringify({
        name: "Quiet Money",
        description: "Members only.",
      }),
    });
    expect(created.status).toBe(201);
    const { id: circleId } = (await created.json()) as { id: string };

    const asOwner = await SELF.fetch(
      `https://local.test/v1/circles/${circleId}`,
      {
        headers: { cookie: owner },
      },
    );
    expect(asOwner.status).toBe(200);

    for (const path of [
      `/v1/circles/${circleId}`,
      `/v1/circles/${circleId}/feed`,
    ]) {
      const denied = await SELF.fetch(`https://local.test${path}`, {
        headers: { cookie: stranger },
      });
      expect(denied.status).toBe(403);
    }

    // A non-member must not be able to mint a live-room ticket either, or the
    // socket would hand them everything the HTTP routes just refused.
    const ticket = await SELF.fetch(
      `https://local.test/v1/circles/${circleId}/live-ticket`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: stranger },
        body: "{}",
      },
    );
    expect(ticket.status).toBe(403);

    // And the circle must not even appear in a stranger's own list.
    const list = await SELF.fetch("https://local.test/v1/circles", {
      headers: { cookie: stranger },
    });
    const { circles } = (await list.json()) as {
      circles: Array<{ id: string }>;
    };
    expect(circles.some((circle) => circle.id === circleId)).toBe(false);
  });

  /**
   * A cheer used to be permanent — `INSERT OR IGNORE` with no way back — so a
   * second tap silently did nothing. Removing one must take back only your own.
   */
  it("lets a member take back their own reaction and nobody else's", async () => {
    const signIn = async () => {
      const response = await SELF.fetch(
        "https://local.test/api/auth/sign-in/anonymous",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "keptseeker://",
          },
          body: "{}",
        },
      );
      return response.headers.get("set-cookie") ?? "";
    };
    const owner = await signIn();

    const created = await SELF.fetch("https://local.test/v1/circles", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner },
      body: JSON.stringify({ name: "Cheer Squad" }),
    });
    const { id: circleId } = (await created.json()) as { id: string };

    // Creating a circle posts a "joined" entry, which is something to react to.
    const feed = await SELF.fetch(
      `https://local.test/v1/circles/${circleId}/feed`,
      {
        headers: { cookie: owner },
      },
    );
    const { posts } = (await feed.json()) as Array<unknown> & {
      posts: Array<{ id: string }>;
    };
    const postId = posts[0].id;

    const reactions = async () => {
      const response = await SELF.fetch(
        `https://local.test/v1/circles/${circleId}/feed`,
        {
          headers: { cookie: owner },
        },
      );
      const body = (await response.json()) as {
        posts: Array<{ reactions: string | null }>;
      };
      return body.posts[0].reactions ?? "";
    };

    const react = (method: string, query = "") =>
      SELF.fetch(
        `https://local.test/v1/circles/${circleId}/posts/${postId}/reactions${query}`,
        {
          method,
          headers: { "content-type": "application/json", cookie: owner },
          body: method === "POST" ? JSON.stringify({ emoji: "🔥" }) : undefined,
        },
      );

    expect((await react("POST")).status).toBe(201);
    expect(await reactions()).toContain("🔥");

    // Re-adding stays idempotent rather than doubling up.
    expect((await react("POST")).status).toBe(201);
    expect((await reactions()).match(/🔥/g)?.length).toBe(1);

    expect(
      (await react("DELETE", `?emoji=${encodeURIComponent("🔥")}`)).status,
    ).toBe(200);
    expect(await reactions()).not.toContain("🔥");

    // An emoji outside the set is refused on the way out as well as in.
    const rejected = await react("DELETE", "?emoji=%F0%9F%92%A9");
    expect(rejected.status).toBe(422);
  });

  /**
   * A nudge points at a person rather than a post, so its fences are the whole
   * feature: one per person per week, only into an open promise, only inside
   * the circle, never at yourself.
   */
  it("fences a nudge to one open promise per friend per week", async () => {
    const signIn = async () => {
      const response = await SELF.fetch(
        "https://local.test/api/auth/sign-in/anonymous",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "keptseeker://",
          },
          body: "{}",
        },
      );
      return response.headers.get("set-cookie") ?? "";
    };
    const post = (path: string, cookie: string, body: unknown = {}) =>
      SELF.fetch(`https://local.test${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      });

    const owner = await signIn();
    const friend = await signIn();

    const created = await post("/v1/circles", owner, { name: "Nudge Club" });
    const { id: circleId } = (await created.json()) as { id: string };

    // The friend joins through a real invite rather than a direct insert.
    const invited = await post(`/v1/circles/${circleId}/invites`, owner, {});
    const { invite } = (await invited.json()) as {
      invite: { deepLink: string };
    };
    const token = invite.deepLink.split("/").pop() as string;
    expect((await post(`/v1/invites/${token}/accept`, friend)).status).toBe(
      200,
    );

    const friendId = await (async () => {
      const me = await SELF.fetch("https://local.test/v1/me", {
        headers: { cookie: friend },
      });
      return ((await me.json()) as { profile: { id: string } }).profile.id;
    })();

    // With no open promise there is nothing to nudge about.
    const tooEarly = await post(
      `/v1/circles/${circleId}/members/${friendId}/nudge`,
      owner,
    );
    expect(tooEarly.status).toBe(409);
    expect(
      ((await tooEarly.json()) as { error: { code: string } }).error.code,
    ).toBe("nothing_to_nudge");

    // Give the friend a promise that is still open: due a week from now.
    const goal = await post("/v1/goals", friend, {
      title: "Show up",
      targetType: "weekly_consistency",
      targetValue: 12,
      visibility: "progress_only",
    });
    const { id: goalId } = (await goal.json()) as { id: string };
    const dueAt = new Date(Date.now() + 5 * 86_400_000).toISOString();
    expect(
      (
        await post(`/v1/goals/${goalId}/promises`, friend, {
          weekStart: new Date().toISOString().slice(0, 10),
          dueAt,
        })
      ).status,
    ).toBe(201);

    const first = await post(
      `/v1/circles/${circleId}/members/${friendId}/nudge`,
      owner,
    );
    expect(first.status).toBe(201);

    // The UNIQUE key is the rate limit: one per person per week.
    const again = await post(
      `/v1/circles/${circleId}/members/${friendId}/nudge`,
      owner,
    );
    expect(again.status).toBe(409);
    expect(
      ((await again.json()) as { error: { code: string } }).error.code,
    ).toBe("already_nudged");

    const self = await post(
      `/v1/circles/${circleId}/members/${friendId}/nudge`,
      friend,
    );
    expect(self.status).toBe(422);
    expect(
      ((await self.json()) as { error: { code: string } }).error.code,
    ).toBe("self_nudge");

    // And it shows up in the award counters the screen reads.
    const awards = await SELF.fetch("https://local.test/v1/awards", {
      headers: { cookie: owner },
    });
    const { counters } = (await awards.json()) as {
      counters: { nudgesSent: number; friends: number };
    };
    expect(counters.nudgesSent).toBe(1);
    expect(counters.friends).toBeGreaterThanOrEqual(1);
  });

  it("does not expose an invalid invitation", async () => {
    const response = await SELF.fetch(
      "https://local.test/v1/invites/not-a-real-token",
    );
    expect(response.status).toBe(404);
  });

  it("rejects forged live-room tickets", async () => {
    const response = await SELF.fetch(
      "https://local.test/v1/live/circle_fake?ticket=forged.ticket",
      {
        headers: { upgrade: "websocket" },
      },
    );
    expect(response.status).toBe(401);
  });

  it("verifies the signed payload a real mobile wallet returns", async () => {
    const signIn = await SELF.fetch(
      "https://local.test/api/auth/sign-in/anonymous",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "keptseeker://",
        },
        body: "{}",
      },
    );
    const cookie = signIn.headers.get("set-cookie") ?? "";
    const privateKey = ed25519.utils.randomSecretKey();
    const walletAddress = bs58.encode(ed25519.getPublicKey(privateKey));
    const challenge = await SELF.fetch(
      "https://local.test/v1/wallets/challenge",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ address: walletAddress }),
      },
    );
    const challengePayload = (await challenge.json()) as {
      challengeId: string;
      message: string;
    };

    // Mobile Wallet Adapter returns the SIGNED PAYLOAD — the message with the signature
    // appended — base64 encoded, which runs to ~376 characters. The bare base58 signature
    // the test above sends is a shape no wallet produces, which is how a 256-character cap
    // on this field survived: it rejected every real wallet with a 422 before the
    // signature was ever checked.
    const message = new TextEncoder().encode(challengePayload.message);
    const signedPayload = new Uint8Array(message.length + 64);
    signedPayload.set(message);
    signedPayload.set(ed25519.sign(message, privateKey), message.length);
    const signature = btoa(String.fromCharCode(...signedPayload));
    expect(signature.length).toBeGreaterThan(256);

    const verify = await SELF.fetch("https://local.test/v1/wallets/verify", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        challengeId: challengePayload.challengeId,
        signature,
      }),
    });
    expect(verify.status).toBe(201);
    expect(await verify.json()).toMatchObject({
      wallet: { address: walletAddress, verified: true },
    });
  });

  it("requires a wallet-linked user to acknowledge Tessera's private-market risks", async () => {
    const signIn = await SELF.fetch(
      "https://local.test/api/auth/sign-in/anonymous",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "keptseeker://",
        },
        body: "{}",
      },
    );
    const cookie = signIn.headers.get("set-cookie") ?? "";
    const privateKey = ed25519.utils.randomSecretKey();
    const walletAddress = bs58.encode(ed25519.getPublicKey(privateKey));
    const challenge = await SELF.fetch(
      "https://local.test/v1/wallets/challenge",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ address: walletAddress }),
      },
    );
    const challengePayload = (await challenge.json()) as {
      challengeId: string;
      message: string;
    };
    const signature = bs58.encode(
      ed25519.sign(
        new TextEncoder().encode(challengePayload.message),
        privateKey,
      ),
    );
    const verify = await SELF.fetch("https://local.test/v1/wallets/verify", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        challengeId: challengePayload.challengeId,
        signature,
      }),
    });
    expect(verify.status).toBe(201);

    const order = await SELF.fetch("https://local.test/v1/trades/order", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        outputMint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
        outputSymbol: "tOpenAI",
        amountUsdc: 25,
        taker: walletAddress,
      }),
    });
    expect(order.status).toBe(422);
    expect(await order.json()).toMatchObject({
      error: { code: "tessera_acknowledgement_required" },
    });
  });

  it("refuses to run without a real auth secret", async () => {
    for (const secret of [undefined, "", "too-short"]) {
      const bare = { ...env, BETTER_AUTH_SECRET: secret } as unknown as AppEnv;
      const signIn = await app.request(
        "/api/auth/sign-in/anonymous",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "keptseeker://",
          },
          body: "{}",
        },
        bare,
      );
      expect(signIn.status).toBe(503);
      expect((await app.request("/v1/me", {}, bare)).status).toBe(503);
    }
    // Health still answers, so a monitor can tell "down" from "misconfigured".
    const health = await app.request("/health", {}, {
      ...env,
      BETTER_AUTH_SECRET: "",
    } as unknown as AppEnv);
    expect(health.status).toBe(200);
  });

  it("runs the nightly jobs on exactly one five-minute tick a day", () => {
    const tick = (hh: number, mm: number) => Date.UTC(2026, 8, 23, hh, mm);
    expect(isNightlyTick(tick(1, 15))).toBe(true);
    for (const [hh, mm] of [
      [1, 10],
      [1, 20],
      [0, 15],
      [13, 15],
    ])
      expect(isNightlyTick(tick(hh, mm))).toBe(false);
    // Every tick of a day, counted: one.
    let nightly = 0;
    for (let minute = 0; minute < 24 * 60; minute += 5)
      if (isNightlyTick(Date.UTC(2026, 8, 23, 0, minute))) nightly += 1;
    expect(nightly).toBe(1);
  });

  it("reminds an open promise once, not on every nightly run", async () => {
    // The cron is daily and the reminder window is two days wide, so before
    // `reminded_at` existed the same promise matched on two consecutive nights
    // and the user was nudged twice for one week.
    const userId = "reminder-user";
    const goalId = "reminder-goal";
    const dueAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
         VALUES (?, 'Reminder', 'reminder@local.test', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ).bind(userId),
      env.DB.prepare(
        `INSERT INTO goals (id, user_id, title, target_type, target_value, status)
         VALUES (?, ?, 'Reminder goal', 'weekly_consistency', 12, 'active')`,
      ).bind(goalId, userId),
      env.DB.prepare(
        `INSERT INTO weekly_promises (id, goal_id, user_id, week_start, due_at, target_cents)
         VALUES ('reminder-promise', ?, ?, '2000-01-03', ?, 2500)`,
      ).bind(goalId, userId, dueAt),
    ]);

    const first = await runWeeklyReminder(env);
    expect(first).toBeGreaterThan(0);

    const stamped = await env.DB.prepare(
      "SELECT reminded_at FROM weekly_promises WHERE id = 'reminder-promise'",
    ).first<{ reminded_at: string | null }>();
    expect(stamped?.reminded_at).not.toBeNull();

    // Second nightly run on the same open promise must stay silent.
    const second = await runWeeklyReminder(env);
    expect(second).toBeUndefined();
  });

  /**
   * Selling.
   *
   * The failure modes here are quiet ones — a sell filed against the wrong mint,
   * or average cost applied to the wrong denominator — so these check the numbers
   * rather than the status codes.
   */
  describe("selling", () => {
    const signIn = async () => {
      const response = await SELF.fetch(
        "https://local.test/api/auth/sign-in/anonymous",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "keptseeker://",
          },
          body: "{}",
        },
      );
      const cookie = response.headers.get("set-cookie") ?? "";
      const me = await SELF.fetch("https://local.test/v1/me", {
        headers: { cookie },
      });
      const { profile } = (await me.json()) as { profile: { id: string } };
      return { cookie, userId: profile.id };
    };

    const MINT = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";

    /** Writes a settled row straight to the table, which is what verification leaves behind. */
    const settle = (
      userId: string,
      direction: "buy" | "sell",
      units: string,
      usdcBaseUnits: string,
      signature: string,
    ) =>
      env.DB.prepare(
        `INSERT INTO contributions
           (id, user_id, wallet_address, signature, asset_symbol, asset_mint, asset_decimals,
            amount_base_units, verified_amount_base_units, input_amount_usdc_base_units,
            status, direction, execution_mode, verified_at, occurred_at)
         VALUES (?, ?, 'wallet', ?, 'SPYx', ?, 9, ?, ?, ?, 'verified', ?, 'live',
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
        .bind(
          `contribution_${signature}`,
          userId,
          signature,
          MINT,
          units,
          units,
          usdcBaseUnits,
          direction,
        )
        .run();

    it("refuses a sell without a verified wallet", async () => {
      const { cookie } = await signIn();
      const response = await SELF.fetch(
        "https://local.test/v1/trades/sell-order",
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({
            inputMint: MINT,
            quantity: 1,
            taker: "7cVfgArCheMR6Cs4t6vz5rfnqd56vZq4ndaBrY5xkxXy",
          }),
        },
      );
      expect(response.status).toBe(403);
    });

    /**
     * The invariant the whole feature rests on: two buys at different prices, then
     * a partial sale, and every figure has to move to the right place.
     *
     * 10 units for $100 and 10 for $300 is an average of $20/unit. Selling 5 for
     * $150 realises 150 − (5 × 20) = $50 and leaves 15 units at a $300 basis.
     * Cost must fall to the basis of what remains — NOT stay at total spend, which
     * is the bug that makes unrealised P&L lie the moment anything is sold.
     */
    it("keeps average cost and realised P&L straight across a partial sale", async () => {
      const { cookie, userId } = await signIn();
      await settle(
        userId,
        "buy",
        "10000000000",
        "100000000",
        `buy_a_${userId}`,
      );
      await settle(
        userId,
        "buy",
        "10000000000",
        "300000000",
        `buy_b_${userId}`,
      );
      await settle(
        userId,
        "sell",
        "5000000000",
        "150000000",
        `sell_a_${userId}`,
      );

      const response = await SELF.fetch("https://local.test/v1/portfolio", {
        headers: { cookie },
      });
      expect(response.status).toBe(200);
      const { portfolio } = (await response.json()) as {
        portfolio: {
          totals: { realisedUsd: number; costUsd: number; positions: number };
          positions: Array<{
            quantity: number;
            costUsd: number;
            avgCostUsd: number | null;
            realisedUsd: number;
            proceedsUsd: number;
            lots: number;
            sells: number;
            open: boolean;
          }>;
        };
      };

      const position = portfolio.positions[0]!;
      expect(position.quantity).toBeCloseTo(15, 6);
      expect(position.costUsd).toBeCloseTo(300, 6);
      expect(position.avgCostUsd).toBeCloseTo(20, 6);
      expect(position.realisedUsd).toBeCloseTo(50, 6);
      expect(position.proceedsUsd).toBeCloseTo(150, 6);
      expect(position.lots).toBe(2);
      expect(position.sells).toBe(1);
      expect(position.open).toBe(true);
      expect(portfolio.totals.realisedUsd).toBeCloseTo(50, 6);
      expect(portfolio.totals.costUsd).toBeCloseTo(300, 6);
    });

    /**
     * A position sold down to nothing keeps its row and its realised P&L, but stops
     * counting as a holding. Dropping it would quietly erase the trade from history.
     */
    it("keeps a fully sold position out of holdings but keeps its realised P&L", async () => {
      const { cookie, userId } = await signIn();
      await settle(userId, "buy", "4000000000", "80000000", `buy_c_${userId}`);
      await settle(
        userId,
        "sell",
        "4000000000",
        "95000000",
        `sell_c_${userId}`,
      );

      const response = await SELF.fetch("https://local.test/v1/portfolio", {
        headers: { cookie },
      });
      const { portfolio } = (await response.json()) as {
        portfolio: {
          totals: { positions: number; costUsd: number; realisedUsd: number };
          positions: Array<{
            open: boolean;
            quantity: number;
            realisedUsd: number;
          }>;
        };
      };

      expect(portfolio.positions).toHaveLength(1);
      expect(portfolio.positions[0]!.open).toBe(false);
      expect(portfolio.positions[0]!.quantity).toBeCloseTo(0, 6);
      expect(portfolio.positions[0]!.realisedUsd).toBeCloseTo(15, 6);
      // No open holdings, so nothing to have a cost basis.
      expect(portfolio.totals.positions).toBe(0);
      expect(portfolio.totals.costUsd).toBeCloseTo(0, 6);
      expect(portfolio.totals.realisedUsd).toBeCloseTo(15, 6);
    });

    /**
     * Sells share the contributions table and store their PROCEEDS in the same
     * column a buy uses for SPEND. Every reader that means "money in" therefore has
     * to say so, and the widget is the one that shows it to the reader every day.
     * Without the filter, selling reads as depositing.
     */
    it("does not count a sell as money put in", async () => {
      const { cookie, userId } = await signIn();
      await settle(userId, "buy", "1000000000", "20000000", `w_buy_${userId}`);
      await settle(userId, "sell", "500000000", "90000000", `w_sell_${userId}`);

      const response = await SELF.fetch(
        "https://local.test/v1/widget/snapshot",
        {
          headers: { cookie },
        },
      );
      expect(response.status).toBe(200);
      const { snapshot } = (await response.json()) as {
        snapshot: {
          summary: { contributions: { monthUsd: number; recentUsd: number[] } };
        };
      };

      // The $20 buy, and nothing from the $90 sale.
      expect(snapshot.summary.contributions.monthUsd).toBeCloseTo(20, 6);
      expect(snapshot.summary.contributions.recentUsd).toEqual([20]);
    });

    /** A sell is not an achievement: it must never close a week or reach a feed. */
    it("does not let a sell close a weekly promise", async () => {
      const { cookie, userId } = await signIn();
      const goal = await SELF.fetch("https://local.test/v1/goals", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          title: "Reserve",
          targetValue: 12,
          weeklyTargetCents: 2000,
        }),
      });
      expect(goal.status).toBe(201);
      const { id: goalId } = (await goal.json()) as { id: string };

      await env.DB.prepare(
        `INSERT INTO weekly_promises (id, goal_id, user_id, week_start, due_at, target_cents)
         VALUES (?, ?, ?, date('now'), datetime('now', '+2 days'), 2000)`,
      )
        .bind(`promise_sell_${userId}`, goalId, userId)
        .run();

      await settle(
        userId,
        "sell",
        "1000000000",
        "25000000",
        `sell_promise_${userId}`,
      );

      const promise = await env.DB.prepare(
        "SELECT completed_at FROM weekly_promises WHERE id = ?",
      )
        .bind(`promise_sell_${userId}`)
        .first<{ completed_at: string | null }>();
      expect(promise?.completed_at).toBeNull();
    });
  });
});

/**
 * Launch readiness: the ways back in, the ways out, and the purchases that
 * used to get stuck.
 */
describe("Launch readiness", () => {
  const signIn = async () => {
    const response = await SELF.fetch(
      "https://local.test/api/auth/sign-in/anonymous",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "keptseeker://",
        },
        body: "{}",
      },
    );
    return response.headers.get("set-cookie") ?? "";
  };

  const call = (cookie: string, path: string, init: RequestInit = {}) =>
    SELF.fetch(`https://local.test${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        origin: "keptseeker://",
        cookie,
        ...(init.headers ?? {}),
      },
    });

  const whoAmI = async (cookie: string) => {
    const response = await call(cookie, "/v1/me");
    if (response.status !== 200) return null;
    const payload = (await response.json()) as {
      profile: { id: string };
      wallets: Array<{ address: string }>;
    };
    return payload;
  };

  /** A wallet, and a signed challenge from it for whichever session asks. */
  /**
   * `bare` is a base58 64-byte signature. `mwa` is what Mobile Wallet Adapter really
   * returns: the message with the signature appended, base64, ~376 characters — sent
   * unpadded, which is the shape that used to be mistaken for base58.
   */
  const wallet = (shape: "bare" | "mwa" = "bare") => {
    const privateKey = ed25519.utils.randomSecretKey();
    const address = bs58.encode(ed25519.getPublicKey(privateKey));
    const signFor = async (cookie: string) => {
      const response = await call(cookie, "/v1/wallets/challenge", {
        method: "POST",
        body: JSON.stringify({ address }),
      });
      const { challengeId, message } = (await response.json()) as {
        challengeId: string;
        message: string;
      };
      const bytes = new TextEncoder().encode(message);
      const raw = ed25519.sign(bytes, privateKey);
      if (shape === "bare") return { challengeId, signature: bs58.encode(raw) };
      const payload = new Uint8Array(bytes.length + 64);
      payload.set(bytes);
      payload.set(raw, bytes.length);
      const signature = btoa(String.fromCharCode(...payload)).replaceAll(
        "=",
        "",
      );
      return { challengeId, signature };
    };
    return { address, signFor };
  };

  it("restores an account from the signed payload a real wallet returns", async () => {
    const original = await signIn();
    const w = wallet("mwa");
    const first = await w.signFor(original);
    expect(first.signature.length).toBeGreaterThan(256);
    const linked = await call(original, "/v1/wallets/verify", {
      method: "POST",
      body: JSON.stringify(first),
    });
    expect(linked.status).toBe(201);
    const originalId = (await whoAmI(original))!.profile.id;

    const fresh = await signIn();
    const restored = await call(fresh, "/api/auth/sign-in/wallet", {
      method: "POST",
      body: JSON.stringify(await w.signFor(fresh)),
    });
    expect(restored.status).toBe(200);
    const me = await whoAmI(restored.headers.get("set-cookie") ?? "");
    expect(me?.profile.id).toBe(originalId);
  });

  it("restores an account on a new device from its linked wallet", async () => {
    const original = await signIn();
    const w = wallet();
    const linked = await call(original, "/v1/wallets/verify", {
      method: "POST",
      body: JSON.stringify(await w.signFor(original)),
    });
    expect(linked.status).toBe(201);
    const originalId = (await whoAmI(original))!.profile.id;

    // Reinstall: a fresh anonymous session, then the same wallet.
    const fresh = await signIn();
    const freshId = (await whoAmI(fresh))!.profile.id;
    const signed = await w.signFor(fresh);
    const refused = await call(fresh, "/v1/wallets/verify", {
      method: "POST",
      body: JSON.stringify(signed),
    });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({
      error: { code: "wallet_linked_elsewhere" },
    });

    // The same signature completes the switch — one wallet prompt, not two.
    const switched = await call(fresh, "/api/auth/sign-in/wallet", {
      method: "POST",
      body: JSON.stringify(signed),
    });
    expect(switched.status).toBe(200);
    expect(await switched.json()).toMatchObject({ switched: true });
    const restored = switched.headers.get("set-cookie") ?? "";
    const me = await whoAmI(restored);
    expect(me?.profile.id).toBe(originalId);
    expect(me?.wallets.map((row) => row.address)).toEqual([w.address]);

    // The empty account left behind is gone, and so is its session.
    expect(await whoAmI(fresh)).toBeNull();
    const leftover = await env.DB.prepare('SELECT id FROM "user" WHERE id = ?')
      .bind(freshId)
      .first();
    expect(leftover).toBeNull();

    // A signature is single-use.
    const replay = await call(restored, "/api/auth/sign-in/wallet", {
      method: "POST",
      body: JSON.stringify(signed),
    });
    expect(replay.status).toBe(422);
  });

  it("falls back to linking when no account uses the wallet yet", async () => {
    const cookie = await signIn();
    const w = wallet();
    const signed = await w.signFor(cookie);
    const signInAttempt = await call(cookie, "/api/auth/sign-in/wallet", {
      method: "POST",
      body: JSON.stringify(signed),
    });
    expect(signInAttempt.status).toBe(404);
    expect(await signInAttempt.json()).toMatchObject({
      code: "wallet_not_linked",
    });
    // Not consumed by the miss, so the same signature links it.
    const linked = await call(cookie, "/v1/wallets/verify", {
      method: "POST",
      body: JSON.stringify(signed),
    });
    expect(linked.status).toBe(201);
  });

  it("refuses a wallet sign-in with someone else's signature", async () => {
    const cookie = await signIn();
    const w = wallet();
    const { challengeId } = await w.signFor(cookie);
    const forged = bs58.encode(
      ed25519.sign(
        new TextEncoder().encode("anything"),
        ed25519.utils.randomSecretKey(),
      ),
    );
    const response = await call(cookie, "/api/auth/sign-in/wallet", {
      method: "POST",
      body: JSON.stringify({ challengeId, signature: forged }),
    });
    expect(response.status).toBe(422);
  });

  it("unlinks a wallet so it can be linked elsewhere", async () => {
    const first = await signIn();
    const w = wallet();
    await call(first, "/v1/wallets/verify", {
      method: "POST",
      body: JSON.stringify(await w.signFor(first)),
    });
    const unlinked = await call(first, `/v1/wallets/${w.address}`, {
      method: "DELETE",
    });
    expect(unlinked.status).toBe(204);
    const second = await signIn();
    const relinked = await call(second, "/v1/wallets/verify", {
      method: "POST",
      body: JSON.stringify(await w.signFor(second)),
    });
    expect(relinked.status).toBe(201);
  });

  it("gates buying, never selling, on accepting the terms", async () => {
    const cookie = await signIn();
    const w = wallet();
    await call(cookie, "/v1/wallets/verify", {
      method: "POST",
      body: JSON.stringify(await w.signFor(cookie)),
    });
    const before = (await (await call(cookie, "/v1/me")).json()) as {
      terms: { accepted: boolean; current: number };
    };
    expect(before.terms.accepted).toBe(false);

    const order = () =>
      call(cookie, "/v1/trades/order", {
        method: "POST",
        body: JSON.stringify({
          outputMint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
          outputSymbol: "tOpenAI",
          amountUsdc: 25,
          taker: w.address,
          tesseraAcknowledged: true,
        }),
      });
    const refused = await order();
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({
      error: { code: "terms_required" },
    });

    // An absence of refusal is not agreement: both statements must be `true`.
    const halfhearted = await call(cookie, "/v1/me/terms", {
      method: "POST",
      body: JSON.stringify({
        version: before.terms.current,
        acceptTerms: true,
        notRestricted: false,
      }),
    });
    expect(halfhearted.status).toBe(422);

    const accepted = await call(cookie, "/v1/me/terms", {
      method: "POST",
      body: JSON.stringify({
        version: before.terms.current,
        acceptTerms: true,
        notRestricted: true,
      }),
    });
    expect(accepted.status).toBe(200);
    // Past the gate. What happens next depends on devnet being reachable.
    expect((await order()).status).not.toBe(403);

    // Selling has no such gate — a fresh account is refused for having nothing
    // to sell, never for not having accepted the terms.
    const other = await signIn();
    const w2 = wallet();
    await call(other, "/v1/wallets/verify", {
      method: "POST",
      body: JSON.stringify(await w2.signFor(other)),
    });
    const sell = await call(other, "/v1/trades/sell-order", {
      method: "POST",
      body: JSON.stringify({
        inputMint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
        quantity: 1,
        taker: w2.address,
      }),
    });
    expect(await sell.text()).not.toContain("terms_required");
  });

  it("lets crypto through on the short statement, and stocks only on the full one", async () => {
    const cookie = await signIn();
    const w = wallet();
    await call(cookie, "/v1/wallets/verify", {
      method: "POST",
      body: JSON.stringify(await w.signFor(cookie)),
    });
    const me = async () =>
      (
        (await (await call(cookie, "/v1/me")).json()) as {
          terms: {
            current: number;
            accepted: boolean;
            securitiesAccepted: boolean;
            restrictedJurisdictions: string[];
            cryptoRestrictedJurisdictions: string[];
          };
        }
      ).terms;
    const before = await me();
    expect(before.cryptoRestrictedJurisdictions).toContain(
      "the United Kingdom",
    );
    expect(before.cryptoRestrictedJurisdictions).not.toContain(
      "the United States",
    );
    expect(before.restrictedJurisdictions).toContain("the United States");

    const buy = (outputSymbol: string, outputMint: string) =>
      call(cookie, "/v1/trades/order", {
        method: "POST",
        body: JSON.stringify({
          outputMint,
          outputSymbol,
          amountUsdc: 5,
          taker: w.address,
          tesseraAcknowledged: true,
        }),
      });
    const sol = () => buy("SOL", "So11111111111111111111111111111111111111112");
    const openAi = () =>
      buy("tOpenAI", "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ");
    expect((await sol()).status).toBe(403);

    // The crypto statement alone: crypto passes, a private-market token does not.
    const short = await call(cookie, "/v1/me/terms", {
      method: "POST",
      body: JSON.stringify({
        version: before.current,
        acceptTerms: true,
        notCryptoRestricted: true,
      }),
    });
    expect(short.status).toBe(200);
    expect(await me()).toMatchObject({
      accepted: true,
      securitiesAccepted: false,
    });
    expect((await sol()).status).not.toBe(403);
    const refused = await openAi();
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({
      error: { code: "terms_required" },
    });

    // The full statement, as app 1.1.0 sends it, covers both.
    await call(cookie, "/v1/me/terms", {
      method: "POST",
      body: JSON.stringify({
        version: before.current,
        acceptTerms: true,
        notRestricted: true,
      }),
    });
    expect(await me()).toMatchObject({
      accepted: true,
      securitiesAccepted: true,
    });
    expect((await openAi()).status).not.toBe(403);

    // Terms alone, with no statement about where you live, are refused.
    const bare = await call(cookie, "/v1/me/terms", {
      method: "POST",
      body: JSON.stringify({ version: before.current, acceptTerms: true }),
    });
    expect(bare.status).toBe(422);
  });

  it('does not name every anonymous account "Anonymous"', async () => {
    const me = (await (await call(await signIn(), "/v1/me")).json()) as {
      profile: { displayName: string };
    };
    expect(me.profile.displayName).toMatch(/^Member [0-9A-Z]{4}$/);
  });

  it("keeps the rest of a profile when one field changes", async () => {
    const cookie = await signIn();
    await call(cookie, "/v1/me", {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Maya" }),
    });
    const patched = await call(cookie, "/v1/me", {
      method: "PATCH",
      body: JSON.stringify({ privacyMode: "amounts" }),
    });
    expect(await patched.json()).toMatchObject({
      profile: { displayName: "Maya", privacyMode: "amounts" },
    });
  });

  const invite = async (owner: string, circleId: string) => {
    const response = await call(owner, `/v1/circles/${circleId}/invites`, {
      method: "POST",
      body: "{}",
    });
    const payload = (await response.json()) as {
      invite: { deepLink: string };
    };
    return payload.invite.deepLink.split("/").pop()!;
  };

  const makeCircle = async (owner: string) => {
    const response = await call(owner, "/v1/circles", {
      method: "POST",
      body: JSON.stringify({ name: "Exit Club" }),
    });
    return ((await response.json()) as { id: string }).id;
  };

  const join = async (cookie: string, token: string) =>
    call(cookie, `/v1/invites/${token}/accept`, { method: "POST", body: "{}" });

  const circleIds = async (cookie: string) =>
    (
      (await (await call(cookie, "/v1/circles")).json()) as {
        circles: Array<{ id: string; role: string }>;
      }
    ).circles;

  it("lets only the owner rename a circle, and keeps what was left out", async () => {
    const owner = await signIn();
    const member = await signIn();
    const circleId = await makeCircle(owner);
    expect((await join(member, await invite(owner, circleId))).status).toBe(
      200,
    );
    const rename = (cookie: string, body: unknown) =>
      call(cookie, `/v1/circles/${circleId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

    expect((await rename(member, { name: "Mine now" })).status).toBe(403);
    expect((await rename(owner, { name: "x" })).status).toBe(422);
    expect((await rename(owner, {})).status).toBe(422);
    expect(
      (await rename(owner, { description: "One small promise a week." }))
        .status,
    ).toBe(200);
    expect((await rename(owner, { name: "Sunday Savers" })).status).toBe(200);

    const row = await env.DB.prepare(
      "SELECT name, description FROM circles WHERE id = ?",
    )
      .bind(circleId)
      .first();
    expect(row).toEqual({
      name: "Sunday Savers",
      description: "One small promise a week.",
    });
  });

  it("lets a member leave, and only the owner remove someone", async () => {
    const owner = await signIn();
    const member = await signIn();
    const other = await signIn();
    const circleId = await makeCircle(owner);
    expect((await join(member, await invite(owner, circleId))).status).toBe(
      200,
    );
    expect((await join(other, await invite(owner, circleId))).status).toBe(200);
    const memberId = (await whoAmI(member))!.profile.id;
    const otherId = (await whoAmI(other))!.profile.id;

    const overreach = await call(
      member,
      `/v1/circles/${circleId}/members/${otherId}`,
      { method: "DELETE" },
    );
    expect(overreach.status).toBe(403);

    const left = await call(
      member,
      `/v1/circles/${circleId}/members/${memberId}`,
      { method: "DELETE" },
    );
    expect(left.status).toBe(200);
    expect((await circleIds(member)).some((c) => c.id === circleId)).toBe(
      false,
    );
    // And their posts left with them.
    const posts = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM activity_posts WHERE circle_id = ? AND user_id = ?",
    )
      .bind(circleId, memberId)
      .first<{ n: number }>();
    expect(posts?.n).toBe(0);

    const removed = await call(
      owner,
      `/v1/circles/${circleId}/members/${otherId}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);
    expect((await call(other, `/v1/circles/${circleId}`)).status).toBe(403);
  });

  it("hands a circle on when its owner leaves, and deletes it with the last one out", async () => {
    const owner = await signIn();
    const member = await signIn();
    const circleId = await makeCircle(owner);
    await join(member, await invite(owner, circleId));
    const ownerId = (await whoAmI(owner))!.profile.id;
    const memberId = (await whoAmI(member))!.profile.id;

    await call(owner, `/v1/circles/${circleId}/members/${ownerId}`, {
      method: "DELETE",
    });
    const mine = await circleIds(member);
    expect(mine.find((c) => c.id === circleId)?.role).toBe("owner");

    const last = await call(
      member,
      `/v1/circles/${circleId}/members/${memberId}`,
      { method: "DELETE" },
    );
    expect(await last.json()).toMatchObject({ circleDeleted: true });
    const gone = await env.DB.prepare("SELECT id FROM circles WHERE id = ?")
      .bind(circleId)
      .first();
    expect(gone).toBeNull();
  });

  it("deletes an account and everything it held, without taking friends' circles", async () => {
    const leaver = await signIn();
    const friend = await signIn();
    const shared = await makeCircle(leaver);
    const solo = await makeCircle(leaver);
    await join(friend, await invite(leaver, shared));
    await invite(leaver, shared);
    const leaverId = (await whoAmI(leaver))!.profile.id;

    const deleted = await call(leaver, "/v1/me", { method: "DELETE" });
    expect(deleted.status).toBe(204);

    expect(await whoAmI(leaver)).toBeNull();
    const user = await env.DB.prepare('SELECT id FROM "user" WHERE id = ?')
      .bind(leaverId)
      .first();
    expect(user).toBeNull();
    expect((await circleIds(friend)).find((c) => c.id === shared)?.role).toBe(
      "owner",
    );
    const soloRow = await env.DB.prepare("SELECT id FROM circles WHERE id = ?")
      .bind(solo)
      .first();
    expect(soloRow).toBeNull();
  });

  it("rejects a purchase that never landed instead of leaving it pending", async () => {
    const userId = "never-landed-user";
    await env.DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES (?, 'Never', 'never@local.test', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
      .bind(userId)
      .run();
    // A well-formed signature no cluster has ever seen.
    const ghost = bs58.encode(crypto.getRandomValues(new Uint8Array(64)));
    const fresh = bs58.encode(crypto.getRandomValues(new Uint8Array(64)));
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO contributions (id, user_id, wallet_address, signature, asset_mint, status, created_at)
         VALUES ('ghost', ?, ?, ?, 'mint', 'pending', datetime('now', '-20 minutes'))`,
      ).bind(userId, bs58.encode(new Uint8Array(32).fill(7)), ghost),
      env.DB.prepare(
        `INSERT INTO contributions (id, user_id, wallet_address, signature, asset_mint, status)
         VALUES ('fresh', ?, ?, ?, 'mint', 'pending')`,
      ).bind(userId, bs58.encode(new Uint8Array(32).fill(8)), fresh),
    ]);

    // The sweeper picks up the old one and leaves the brand-new one alone.
    const swept = await env.DB.prepare(
      `SELECT id FROM contributions WHERE status = 'pending'
       AND created_at <= datetime('now', '-2 minutes')`,
    ).all<{ id: string }>();
    expect(swept.results.map((row) => row.id)).toContain("ghost");
    expect(swept.results.map((row) => row.id)).not.toContain("fresh");
    expect(await sweepPendingContributions(env)).toBeGreaterThan(0);

    const outcome = { acked: false, retried: false };
    await processQueue(
      {
        queue: "test",
        messages: [
          {
            id: "m1",
            timestamp: new Date(),
            attempts: 1,
            body: { kind: "verify_contribution", contributionId: "ghost" },
            ack: () => void (outcome.acked = true),
            retry: () => void (outcome.retried = true),
          },
        ],
        ackAll() {},
        retryAll() {},
      } as unknown as MessageBatch<Job>,
      env as unknown as AppEnv,
    );
    // Devnet answered "no such transaction" — or was unreachable, in which case
    // the job retries and this check says nothing. Only a definite answer counts.
    if (outcome.acked) {
      const row = await env.DB.prepare(
        "SELECT status, failure_reason FROM contributions WHERE id = 'ghost'",
      ).first<{ status: string; failure_reason: string }>();
      expect(row?.status).toBe("rejected");
      expect(row?.failure_reason).toContain("never confirmed");
    } else {
      expect(outcome.retried).toBe(true);
    }
  });

  it("fills the promise ring for this week only, and the goal ring for the whole goal", async () => {
    const cookie = await signIn();
    const userId = (await whoAmI(cookie))!.profile.id;
    const monday = (weeksAgo: number) => {
      const date = new Date();
      date.setUTCDate(
        date.getUTCDate() - ((date.getUTCDay() + 6) % 7) - weeksAgo * 7,
      );
      return date.toISOString().slice(0, 10);
    };
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO goals (id, user_id, title, target_type, target_value, visibility, status)
         VALUES ('ring-goal', ?, 'Rings', 'weekly_consistency', 4, 'progress_only', 'active')`,
      ).bind(userId),
      // Last week kept; this week still open.
      env.DB.prepare(
        `INSERT INTO weekly_promises (id, goal_id, user_id, week_start, due_at, completed_at)
         VALUES ('ring-last', 'ring-goal', ?, ?, datetime('now', '-2 days'), datetime('now', '-3 days'))`,
      ).bind(userId, monday(1)),
      env.DB.prepare(
        `INSERT INTO weekly_promises (id, goal_id, user_id, week_start, due_at)
         VALUES ('ring-this', 'ring-goal', ?, ?, datetime('now', '+2 days'))`,
      ).bind(userId, monday(0)),
    ]);
    const rings = async () =>
      (
        (await (await call(cookie, "/v1/widget/snapshot")).json()) as {
          snapshot: { rings: { consistency: number; goal: number } };
        }
      ).snapshot.rings;

    expect(await rings()).toMatchObject({ consistency: 0, goal: 0.25 });
    await env.DB.prepare(
      "UPDATE weekly_promises SET completed_at = CURRENT_TIMESTAMP WHERE id = 'ring-this'",
    ).run();
    expect(await rings()).toMatchObject({ consistency: 1, goal: 0.5 });
  });

  it("settles a demo purchase on a local server and nowhere else", async () => {
    const userId = "demo-buyer";
    await env.DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES (?, 'Demo', 'demo@local.test', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
      .bind(userId)
      .run();
    const wallet = bs58.encode(new Uint8Array(32).fill(9));
    await env.DB.batch(
      ["demo-local", "demo-prod"].map((contributionId) =>
        env.DB.prepare(
          `INSERT INTO contributions (id, user_id, wallet_address, signature, asset_mint, amount_base_units, asset_decimals, execution_mode, status)
           VALUES (?, ?, ?, ?, 'mint', '32700000', 9, 'demo', 'pending')`,
        ).bind(contributionId, userId, wallet, `demo-${contributionId}`),
      ),
    );
    const verify = (contributionId: string, target: AppEnv) =>
      processQueue(
        {
          queue: "test",
          messages: [
            {
              id: contributionId,
              timestamp: new Date(),
              attempts: 1,
              body: { kind: "verify_contribution", contributionId },
              ack: () => undefined,
              retry: () => undefined,
            },
          ],
          ackAll() {},
          retryAll() {},
        } as unknown as MessageBatch<Job>,
        target,
      );
    await verify("demo-local", env as unknown as AppEnv);
    await verify("demo-prod", {
      ...env,
      ENVIRONMENT: "production",
    } as unknown as AppEnv);

    const rows = await env.DB.prepare(
      "SELECT id, status, verified_amount_base_units FROM contributions WHERE id IN ('demo-local', 'demo-prod') ORDER BY id",
    ).all<{ id: string; status: string; verified_amount_base_units: string }>();
    expect(rows.results).toEqual([
      {
        id: "demo-local",
        status: "verified",
        verified_amount_base_units: "32700000",
      },
      { id: "demo-prod", status: "rejected", verified_amount_base_units: null },
    ]);
  });

  it("only serves share cards for kept promises", async () => {
    const owner = await signIn();
    const circleId = await makeCircle(owner);
    const joined = await env.DB.prepare(
      "SELECT id FROM activity_posts WHERE circle_id = ? AND kind = 'joined'",
    )
      .bind(circleId)
      .first<{ id: string }>();
    const response = await SELF.fetch(
      `https://local.test/v1/media/share/${joined!.id}.svg`,
    );
    expect(response.status).toBe(404);

    const ownerId = (await whoAmI(owner))!.profile.id;
    await env.DB.prepare(
      `INSERT INTO activity_posts (id, circle_id, user_id, kind, body)
       VALUES ('post_kept_card', ?, ?, 'promise_kept', 'Kept this week')`,
    )
      .bind(circleId, ownerId)
      .run();
    const card = await SELF.fetch(
      "https://local.test/v1/media/share/post_kept_card.svg",
    );
    expect(card.status).toBe(200);
    expect(card.headers.get("content-type")).toBe("image/svg+xml");
    const svg = await card.text();
    expect(svg).toContain(">KEPT<");
    expect(svg).not.toContain("NEON");
  });

  it("counts exactly, and answers 429 with a retry hint once over", async () => {
    // The counter itself: two allowed, the third refused.
    const counter = env.RATE_LIMITER.get(
      env.RATE_LIMITER.idFromName("test:exact"),
    );
    expect(await counter.hit(2, 60_000)).toBe(true);
    expect(await counter.hit(2, 60_000)).toBe(true);
    expect(await counter.hit(2, 60_000)).toBe(false);

    // And the middleware around it, outside `local` where it is switched off.
    const limited = new Hono<{ Bindings: AppEnv; Variables: Variables }>();
    limited.use(
      "*",
      rateLimit("signup", () => "middleware-test"),
    );
    limited.get("/", (c) => c.text("ok"));
    const production = {
      ENVIRONMENT: "production",
      RATE_LIMITER: env.RATE_LIMITER,
    } as unknown as AppEnv;
    const statuses: number[] = [];
    for (let i = 0; i < LIMITS.signup.limit; i += 1) {
      statuses.push((await limited.request("/", {}, production)).status);
    }
    expect(statuses.every((status) => status === 200)).toBe(true);
    const refused = await limited.request("/", {}, production);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBe("60");
    expect(await refused.json()).toMatchObject({
      error: { code: "rate_limited" },
    });
  });
});

describe("crypto on the shelf", () => {
  const WALLET = "Wa11et1111111111111111111111111111111111111";
  const PAYER = "Jup1terPayer111111111111111111111111111111";
  const SOL = "So11111111111111111111111111111111111111112";
  const CBBTC = "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij";
  const FEE = 5_000;

  type Transaction = Parameters<typeof receivedAmount>[0];
  const transaction = (
    meta: Partial<NonNullable<Transaction["meta"]>>,
    keys = [WALLET, PAYER],
  ): Transaction => ({
    blockTime: 1_790_000_000,
    meta: { err: null, ...meta },
    transaction: { message: { accountKeys: keys }, signatures: ["sig"] },
  });

  it("lists SOL, cbBTC and SKR without asking any stock provider", async () => {
    const signIn = await SELF.fetch(
      "https://local.test/api/auth/sign-in/anonymous",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "keptseeker://",
        },
        body: "{}",
      },
    );
    const response = await SELF.fetch(
      "https://local.test/v1/trades/assets?symbols=SOL,cbBTC,SKR",
      { headers: { cookie: signIn.headers.get("set-cookie") ?? "" } },
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { assets: unknown[] };
    expect(payload.assets).toMatchObject([
      {
        symbol: "SOL",
        mint: SOL,
        provider: "crypto",
        instrument: "crypto",
        available: true,
      },
      { symbol: "cbBTC", mint: CBBTC, provider: "crypto", transferFeeBps: 0 },
      {
        symbol: "SKR",
        mint: "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3",
        provider: "crypto",
      },
    ]);
  });

  it("counts a token purchase from token balances, as before", () => {
    const balance = (amount: string) => ({
      mint: CBBTC,
      owner: WALLET,
      uiTokenAmount: { amount, decimals: 8 },
    });
    expect(
      receivedAmount(
        transaction({
          fee: FEE,
          preBalances: [1_000_000_000, 0],
          postBalances: [1_000_000_000 - FEE, 0],
          preTokenBalances: [balance("100")],
          postTokenBalances: [balance("2600")],
        }),
        WALLET,
        CBBTC,
      ),
    ).toEqual({ amount: 2500n, decimals: 8 });
  });

  it("counts SOL bought from lamports, with the fee the wallet paid added back", () => {
    // 0.1 SOL arrives; the wallet paid a 5,000-lamport fee for the swap.
    expect(
      receivedAmount(
        transaction({
          fee: FEE,
          preBalances: [20_000_000, 0],
          postBalances: [20_000_000 + 100_000_000 - FEE, 0],
        }),
        WALLET,
        SOL,
      ),
    ).toEqual({ amount: 100_000_000n, decimals: 9 });
  });

  it("counts SOL sold as a negative delta, fee excluded", () => {
    expect(
      receivedAmount(
        transaction({
          fee: FEE,
          preBalances: [500_000_000, 0],
          postBalances: [500_000_000 - 250_000_000 - FEE, 0],
        }),
        WALLET,
        SOL,
      ),
    ).toEqual({ amount: -250_000_000n, decimals: 9 });
  });

  it("adds nothing back when someone else paid the fee", () => {
    // A gasless route: the router is the fee payer, the wallet only receives.
    expect(
      receivedAmount(
        transaction(
          {
            fee: FEE,
            preBalances: [10_000_000_000, 20_000_000],
            postBalances: [10_000_000_000 - FEE, 120_000_000],
          },
          [PAYER, WALLET],
        ),
        WALLET,
        SOL,
      ),
    ).toEqual({ amount: 100_000_000n, decimals: 9 });
  });

  it("still counts wrapped SOL a wallet keeps wrapped", () => {
    const wrapped = (amount: string) => ({
      mint: SOL,
      owner: WALLET,
      uiTokenAmount: { amount, decimals: 9 },
    });
    expect(
      receivedAmount(
        transaction({
          fee: FEE,
          preBalances: [20_000_000, 0],
          postBalances: [20_000_000 - FEE, 0],
          preTokenBalances: [wrapped("0")],
          postTokenBalances: [wrapped("100000000")],
        }),
        WALLET,
        SOL,
      ),
    ).toEqual({ amount: 100_000_000n, decimals: 9 });
  });
});

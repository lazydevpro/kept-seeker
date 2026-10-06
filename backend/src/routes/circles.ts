import { Hono } from "hono";
import { z } from "zod";
import { ApiError, id, sha256 } from "../lib/http";
import { parseJson, publicProfile } from "../lib/validation";
import { authenticated } from "../middleware/authenticated";
import type { AppEnv, Job, Variables } from "../types";

export const circleRoutes = new Hono<{
  Bindings: AppEnv;
  Variables: Variables;
}>();

function encodeBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/**
 * Invite tokens are the longest part of a link someone has to send a friend, and the
 * old ones were two concatenated UUIDs — 64 characters for an invite that lives 72 hours
 * and admits at most 20 people. Twelve characters of this alphabet is 72 bits, which is
 * not guessable at any rate a circle invite will ever see.
 *
 * The alphabet is exactly 64 characters, so every byte maps to one character with no
 * modulo bias. Tokens are only ever stored hashed, so shortening them needs no migration
 * and links already in someone's messages keep working.
 */
const TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const TOKEN_LENGTH = 12;

function inviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  return Array.from(
    bytes,
    (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length],
  ).join("");
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(
    atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    (character) => character.charCodeAt(0),
  );
}

async function signLiveTicket(env: AppEnv, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.BETTER_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return encodeBase64Url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    ),
  );
}

async function readLiveTicket(env: AppEnv, ticket: string) {
  try {
    const [payload, signature] = ticket.split(".");
    if (!payload || !signature) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.BETTER_AUTH_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const value = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(payload)),
    ) as { userId: string; circleId: string; expires: number };
    return value.expires > Date.now() ? value : null;
  } catch {
    return null;
  }
}

async function requireMember(env: AppEnv, circleId: string, userId: string) {
  const member = await env.DB.prepare(
    "SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?",
  )
    .bind(circleId, userId)
    .first();
  if (!member) throw new ApiError(403, "You are not a member of this circle.");
  return member;
}

circleRoutes.get("/", async (c) => {
  const circles = await c.env.DB.prepare(
    `SELECT c.*, cm.role, (SELECT COUNT(*) FROM circle_members x WHERE x.circle_id = c.id) AS member_count
     FROM circles c JOIN circle_members cm ON cm.circle_id = c.id
     WHERE cm.user_id = ? ORDER BY c.updated_at DESC`,
  )
    .bind(c.get("userId"))
    .all();
  return c.json({ circles: circles.results });
});

circleRoutes.post("/", async (c) => {
  const body = await parseJson(
    c,
    z.object({
      name: z.string().trim().min(2).max(48),
      description: z.string().trim().max(160).optional(),
    }),
  );
  const circleId = id("circle");
  const userId = c.get("userId");
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO circles (id, owner_user_id, name, description) VALUES (?, ?, ?, ?)",
    ).bind(circleId, userId, body.name, body.description ?? null),
    c.env.DB.prepare(
      "INSERT INTO circle_members (circle_id, user_id, role) VALUES (?, ?, 'owner')",
    ).bind(circleId, userId),
    c.env.DB.prepare(
      "INSERT INTO activity_posts (id, circle_id, user_id, kind, body) VALUES (?, ?, ?, 'joined', ?)",
    ).bind(id("post"), circleId, userId, "Started the circle"),
  ]);
  return c.json({ id: circleId }, 201);
});

circleRoutes.get("/:circleId", async (c) => {
  const circleId = c.req.param("circleId");
  await requireMember(c.env, circleId, c.get("userId"));
  const circle = await c.env.DB.prepare("SELECT * FROM circles WHERE id = ?")
    .bind(circleId)
    .first();
  if (!circle) throw new ApiError(404, "Circle not found.");
  /**
   * A member's ring is their newest active goal, and only that goal.
   *
   * The target used to be read from that one goal while the completed count was
   * summed across every active goal the member had. Nothing stops someone
   * keeping two goals at once, and when they did, their ring in everyone else's
   * circle overstated them — and disagreed with their own Goal screen, which
   * has always counted per goal. Both halves now hang off the same `current_goal`.
   */
  const members = await c.env.DB.prepare(
    `WITH current_goal AS (
       SELECT g.user_id, g.id, g.target_value,
              ROW_NUMBER() OVER (PARTITION BY g.user_id ORDER BY g.created_at DESC) AS rank
       FROM goals g WHERE g.status = 'active'
     )
     SELECT p.user_id, p.display_name, p.avatar_key, p.privacy_mode, cm.role, cm.joined_at,
      EXISTS(SELECT 1 FROM weekly_promises wp WHERE wp.user_id = p.user_id AND wp.completed_at IS NOT NULL AND wp.week_start >= date('now', '-7 days')) AS showed_up,
      COALESCE(cg.target_value, 1) AS goal_target,
      (SELECT COUNT(*) FROM weekly_promises wp WHERE wp.goal_id = cg.id AND wp.completed_at IS NOT NULL) AS goal_complete
     FROM circle_members cm
     JOIN profiles p ON p.user_id = cm.user_id
     LEFT JOIN current_goal cg ON cg.user_id = p.user_id AND cg.rank = 1
     WHERE cm.circle_id = ? ORDER BY cm.joined_at`,
  )
    .bind(circleId)
    .all();
  return c.json({
    circle,
    members: members.results.map((row) => ({
      ...publicProfile(row),
      role: row.role,
      showedUp: Boolean(row.showed_up),
      goalProgress: Math.min(
        1,
        Number(row.goal_complete ?? 0) /
          Math.max(1, Number(row.goal_target ?? 1)),
      ),
    })),
  });
});

/** Rename a circle, or change its line of description. The owner's call alone. */
circleRoutes.patch("/:circleId", async (c) => {
  const circleId = c.req.param("circleId");
  const body = await parseJson(
    c,
    z
      .object({
        name: z.string().trim().min(2).max(48).optional(),
        description: z.string().trim().max(160).optional(),
      })
      .refine(
        (value) => value.name !== undefined || value.description !== undefined,
        {
          message: "Nothing to change.",
        },
      ),
  );
  const me = await requireMember(c.env, circleId, c.get("userId"));
  if (me.role !== "owner")
    throw new ApiError(
      403,
      "Only the circle's owner can change it.",
      "not_owner",
    );
  // COALESCE: a field left out keeps its value, same as PATCH /v1/me.
  await c.env.DB.prepare(
    "UPDATE circles SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?",
  )
    .bind(body.name ?? null, body.description ?? null, circleId)
    .run();
  await broadcast(c.env, circleId, { type: "circle.updated" });
  return c.json({ updated: true });
});

circleRoutes.post("/:circleId/invites", async (c) => {
  const circleId = c.req.param("circleId");
  await requireMember(c.env, circleId, c.get("userId"));
  const body = await parseJson(
    c,
    z.object({
      expiresInHours: z.number().int().min(1).max(168).default(72),
      maxUses: z.number().int().min(1).max(20).default(5),
    }),
  );
  const token = inviteToken();
  const inviteId = id("invite");
  const expiresAt = new Date(
    Date.now() + body.expiresInHours * 3_600_000,
  ).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO invites (id, circle_id, created_by, token_hash, expires_at, max_uses) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      inviteId,
      circleId,
      c.get("userId"),
      await sha256(token),
      expiresAt,
      body.maxUses,
    )
    .run();
  return c.json(
    {
      invite: {
        id: inviteId,
        deepLink: `keptseeker://join/${token}`,
        webUrl: `${c.env.PUBLIC_APP_URL.replace(/\/$/, "")}/join/${token}`,
        expiresAt,
      },
    },
    201,
  );
});

circleRoutes.get("/:circleId/feed", async (c) => {
  const circleId = c.req.param("circleId");
  await requireMember(c.env, circleId, c.get("userId"));
  const feed = await c.env.DB.prepare(
    `SELECT ap.id, ap.kind, ap.body, ap.visibility, ap.created_at, p.display_name, p.avatar_key,
      GROUP_CONCAT(r.emoji || ':' || r.user_id, ',') AS reactions
     FROM activity_posts ap JOIN profiles p ON p.user_id = ap.user_id
     LEFT JOIN reactions r ON r.post_id = ap.id
     WHERE ap.circle_id = ? GROUP BY ap.id ORDER BY ap.created_at DESC LIMIT 50`,
  )
    .bind(circleId)
    .all();
  return c.json({ posts: feed.results });
});

const REACTION_EMOJI = z.enum(["👏", "💜", "🔥", "🙌"]);

async function requirePost(env: AppEnv, circleId: string, postId: string) {
  const post = await env.DB.prepare(
    "SELECT id FROM activity_posts WHERE id = ? AND circle_id = ?",
  )
    .bind(postId, circleId)
    .first();
  if (!post) throw new ApiError(404, "Post not found.");
  return post;
}

async function broadcast(env: AppEnv, circleId: string, message: unknown) {
  const room = env.CIRCLE_ROOMS.get(env.CIRCLE_ROOMS.idFromName(circleId));
  await room.fetch("https://circle.internal/broadcast", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-neon-internal": env.BETTER_AUTH_SECRET,
    },
    body: JSON.stringify(message),
  });
}

circleRoutes.post("/:circleId/posts/:postId/reactions", async (c) => {
  const circleId = c.req.param("circleId");
  await requireMember(c.env, circleId, c.get("userId"));
  const body = await parseJson(c, z.object({ emoji: REACTION_EMOJI }));
  const post = await requirePost(c.env, circleId, c.req.param("postId"));
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO reactions (post_id, user_id, emoji) VALUES (?, ?, ?)",
  )
    .bind(post.id, c.get("userId"), body.emoji)
    .run();
  await broadcast(c.env, circleId, {
    type: "reaction.added",
    postId: post.id,
    emoji: body.emoji,
  });
  return c.json({ reacted: true }, 201);
});

/**
 * Take a reaction back.
 *
 * Adding was `INSERT OR IGNORE` with no way out, so a cheer was permanent and a
 * second tap did nothing at all — which read as a broken button rather than as
 * "you already did that".
 */
circleRoutes.delete("/:circleId/posts/:postId/reactions", async (c) => {
  const circleId = c.req.param("circleId");
  await requireMember(c.env, circleId, c.get("userId"));
  const emoji = REACTION_EMOJI.safeParse(c.req.query("emoji"));
  if (!emoji.success)
    throw new ApiError(
      422,
      "That is not one of the reactions.",
      "invalid_input",
    );
  const post = await requirePost(c.env, circleId, c.req.param("postId"));
  await c.env.DB.prepare(
    "DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND emoji = ?",
  )
    .bind(post.id, c.get("userId"), emoji.data)
    .run();
  await broadcast(c.env, circleId, {
    type: "reaction.removed",
    postId: post.id,
    emoji: emoji.data,
  });
  return c.json({ reacted: false });
});

/**
 * Nudge a member whose week is still open.
 *
 * The one social action that points at a person rather than a post, so it is
 * fenced in on purpose: both people must be in the circle, you cannot nudge
 * yourself, and the week has to actually be open — nudging someone who already
 * kept their promise is noise, not encouragement. The UNIQUE key on `nudges`
 * allows one per person per week, which is what stops a circle turning into a
 * place people get poked.
 *
 * The push is best effort. The feed entry is the durable part, so a nudge still
 * lands for someone who has notifications off.
 */
circleRoutes.post("/:circleId/members/:memberId/nudge", async (c) => {
  const circleId = c.req.param("circleId");
  const target = c.req.param("memberId");
  const userId = c.get("userId");

  await requireMember(c.env, circleId, userId);
  if (target === userId)
    throw new ApiError(422, "You cannot nudge yourself.", "self_nudge");
  await requireMember(c.env, circleId, target);

  const open = await c.env.DB.prepare(
    `SELECT week_start FROM weekly_promises
     WHERE user_id = ? AND completed_at IS NULL AND due_at > CURRENT_TIMESTAMP
     ORDER BY week_start DESC LIMIT 1`,
  )
    .bind(target)
    .first<{ week_start: string }>();
  if (!open)
    throw new ApiError(
      409,
      "They have no open promise this week.",
      "nothing_to_nudge",
    );

  const inserted = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO nudges (id, circle_id, from_user_id, to_user_id, week_start)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id("nudge"), circleId, userId, target, open.week_start)
    .run();
  // `changes` is 0 when the UNIQUE key already held a row for this week.
  if (!inserted.meta.changes)
    throw new ApiError(
      409,
      "You already nudged them this week.",
      "already_nudged",
    );

  const me = await c.env.DB.prepare(
    "SELECT display_name FROM profiles WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ display_name: string }>();
  const from = me?.display_name ?? "Someone";

  await c.env.DB.prepare(
    "INSERT INTO activity_posts (id, circle_id, user_id, kind, body) VALUES (?, ?, ?, 'encouragement', ?)",
  )
    .bind(
      id("post"),
      circleId,
      userId,
      `${from} nudged a friend to keep this week`,
    )
    .run();

  await c.env.JOBS.send({
    kind: "send_push",
    userIds: [target],
    title: "A nudge from your circle",
    body: `${from} is cheering you on. Your week is still open.`,
    data: { circleId },
  } satisfies Job);

  await broadcast(c.env, circleId, { type: "nudge.sent", toUserId: target });
  return c.json({ nudged: true, weekStart: open.week_start }, 201);
});

/**
 * Leave a circle, or — for its owner — remove someone from it.
 *
 * `memberId` may be your own id, which is leaving, and anyone may do that. Only
 * the owner may remove somebody else, and the owner is never removed by anyone
 * but themselves.
 *
 * An owner who leaves hands the circle to its longest-standing member rather
 * than taking it with them; the last person out deletes it. Posts they wrote in
 * the feed go with them, because a feed that still shows "Maya kept her promise"
 * after Maya left is showing people something she no longer shares with them.
 */
circleRoutes.delete("/:circleId/members/:memberId", async (c) => {
  const circleId = c.req.param("circleId");
  const target = c.req.param("memberId");
  const userId = c.get("userId");

  const me = await requireMember(c.env, circleId, userId);
  const leaving = target === userId;
  if (!leaving && me.role !== "owner")
    throw new ApiError(
      403,
      "Only the circle's owner can remove someone.",
      "not_owner",
    );
  const them = leaving ? me : await requireMember(c.env, circleId, target);

  const heir =
    them.role === "owner"
      ? await c.env.DB.prepare(
          `SELECT user_id FROM circle_members WHERE circle_id = ? AND user_id != ?
           ORDER BY joined_at ASC LIMIT 1`,
        )
          .bind(circleId, target)
          .first<{ user_id: string }>()
      : null;

  if (them.role === "owner" && !heir) {
    await c.env.DB.prepare("DELETE FROM circles WHERE id = ?")
      .bind(circleId)
      .run();
    return c.json({ left: true, circleDeleted: true });
  }

  await c.env.DB.batch([
    ...(heir
      ? [
          c.env.DB.prepare(
            "UPDATE circles SET owner_user_id = ? WHERE id = ?",
          ).bind(heir.user_id, circleId),
          c.env.DB.prepare(
            "UPDATE circle_members SET role = 'owner' WHERE circle_id = ? AND user_id = ?",
          ).bind(circleId, heir.user_id),
        ]
      : []),
    c.env.DB.prepare(
      "DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?",
    ).bind(circleId, target),
    c.env.DB.prepare(
      "DELETE FROM activity_posts WHERE circle_id = ? AND user_id = ?",
    ).bind(circleId, target),
    c.env.DB.prepare(
      "UPDATE invites SET revoked_at = CURRENT_TIMESTAMP WHERE circle_id = ? AND created_by = ? AND revoked_at IS NULL",
    ).bind(circleId, target),
  ]);

  await broadcast(c.env, circleId, {
    type: "member.left",
    userId: target,
  });
  return c.json({ left: true, circleDeleted: false });
});

circleRoutes.get("/:circleId/live", async (c) => {
  const circleId = c.req.param("circleId");
  await requireMember(c.env, circleId, c.get("userId"));
  const room = c.env.CIRCLE_ROOMS.get(c.env.CIRCLE_ROOMS.idFromName(circleId));
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-neon-user", c.get("userId"));
  headers.set("x-neon-internal", c.env.BETTER_AUTH_SECRET);
  return room.fetch(new Request(c.req.url, { headers }));
});

circleRoutes.post("/:circleId/live-ticket", async (c) => {
  const circleId = c.req.param("circleId");
  const userId = c.get("userId");
  await requireMember(c.env, circleId, userId);
  const payload = encodeBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ userId, circleId, expires: Date.now() + 60_000 }),
    ),
  );
  const ticket = `${payload}.${await signLiveTicket(c.env, payload)}`;
  const url = new URL(c.req.url);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/v1/live/${circleId}`;
  url.search = new URLSearchParams({ ticket }).toString();
  return c.json({ url: url.toString(), expiresIn: 60 });
});

export const inviteRoutes = new Hono<{
  Bindings: AppEnv;
  Variables: Variables;
}>();

export const liveRoutes = new Hono<{ Bindings: AppEnv }>();

liveRoutes.get("/:circleId", async (c) => {
  const authorization = await readLiveTicket(
    c.env,
    c.req.query("ticket") ?? "",
  );
  if (!authorization || authorization.circleId !== c.req.param("circleId")) {
    throw new ApiError(401, "This live-room ticket is invalid or expired.");
  }
  await requireMember(c.env, authorization.circleId, authorization.userId);
  const room = c.env.CIRCLE_ROOMS.get(
    c.env.CIRCLE_ROOMS.idFromName(authorization.circleId),
  );
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-neon-user", authorization.userId);
  headers.set("x-neon-internal", c.env.BETTER_AUTH_SECRET);
  return room.fetch(new Request(c.req.url, { headers }));
});

inviteRoutes.get("/:token", async (c) => {
  const tokenHash = await sha256(c.req.param("token"));
  const invite = await c.env.DB.prepare(
    `SELECT i.id, i.circle_id, i.expires_at, i.max_uses, i.use_count, c.name, c.description,
      (SELECT COUNT(*) FROM circle_members cm WHERE cm.circle_id = c.id) AS member_count
     FROM invites i JOIN circles c ON c.id = i.circle_id
     WHERE i.token_hash = ? AND i.revoked_at IS NULL`,
  )
    .bind(tokenHash)
    .first();
  if (
    !invite ||
    String(invite.expires_at) <= new Date().toISOString() ||
    Number(invite.use_count) >= Number(invite.max_uses)
  ) {
    throw new ApiError(404, "This invite is no longer available.");
  }
  return c.json({
    circle: {
      id: invite.circle_id,
      name: invite.name,
      description: invite.description,
      memberCount: invite.member_count,
    },
  });
});

inviteRoutes.post("/:token/accept", authenticated, async (c) => {
  const token = c.req.param("token");
  if (!token) throw new ApiError(404, "Invite not found.");
  const tokenHash = await sha256(token);
  const invite = await c.env.DB.prepare(
    `SELECT i.*, c.member_limit, (SELECT COUNT(*) FROM circle_members cm WHERE cm.circle_id = i.circle_id) AS member_count
     FROM invites i JOIN circles c ON c.id = i.circle_id WHERE i.token_hash = ? AND i.revoked_at IS NULL`,
  )
    .bind(tokenHash)
    .first();
  if (
    !invite ||
    String(invite.expires_at) <= new Date().toISOString() ||
    Number(invite.use_count) >= Number(invite.max_uses)
  ) {
    throw new ApiError(404, "This invite is no longer available.");
  }
  if (Number(invite.member_count) >= Number(invite.member_limit))
    throw new ApiError(409, "This circle is full.");
  const userId = c.get("userId");
  const existingMember = await c.env.DB.prepare(
    "SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?",
  )
    .bind(invite.circle_id, userId)
    .first();
  if (existingMember)
    return c.json({
      joined: true,
      circleId: invite.circle_id,
      alreadyMember: true,
    });
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT OR IGNORE INTO circle_members (circle_id, user_id, role) VALUES (?, ?, 'member')",
    ).bind(invite.circle_id, userId),
    c.env.DB.prepare(
      "UPDATE invites SET use_count = use_count + 1 WHERE id = ?",
    ).bind(invite.id),
    c.env.DB.prepare(
      "INSERT INTO activity_posts (id, circle_id, user_id, kind, body) VALUES (?, ?, ?, 'joined', ?)",
    ).bind(id("post"), invite.circle_id, userId, "Joined the circle"),
  ]);
  return c.json({ joined: true, circleId: invite.circle_id });
});

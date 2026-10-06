import { Hono } from "hono";
import { z } from "zod";
import { ApiError, id } from "../lib/http";
import {
  CRYPTO_RESTRICTED_JURISDICTIONS,
  RESTRICTED_JURISDICTIONS,
  TERMS_VERSION,
} from "../lib/terms";
import { parseJson, publicProfile } from "../lib/validation";
import type { AppEnv, Variables } from "../types";

export const profileRoutes = new Hono<{
  Bindings: AppEnv;
  Variables: Variables;
}>();

profileRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  let profile = await c.env.DB.prepare(
    "SELECT * FROM profiles WHERE user_id = ?",
  )
    .bind(userId)
    .first();
  if (!profile) {
    const displayName = `Member ${userId.slice(-4).toUpperCase()}`;
    await c.env.DB.prepare(
      "INSERT INTO profiles (user_id, display_name) VALUES (?, ?)",
    )
      .bind(userId, displayName)
      .run();
    profile = await c.env.DB.prepare("SELECT * FROM profiles WHERE user_id = ?")
      .bind(userId)
      .first();
  }
  const wallets = await c.env.DB.prepare(
    "SELECT id, address, chain, verified_at FROM wallet_connections WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(userId)
    .all();
  return c.json({
    profile: publicProfile(profile ?? {}),
    wallets: wallets.results,
    terms: {
      current: TERMS_VERSION,
      // The terms, with the statement crypto needs.
      accepted: Number(profile?.terms_version ?? 0) >= TERMS_VERSION,
      // The fuller statement stocks and private markets need as well.
      securitiesAccepted:
        Number(profile?.securities_terms_version ?? 0) >= TERMS_VERSION,
      restrictedJurisdictions: RESTRICTED_JURISDICTIONS,
      cryptoRestrictedJurisdictions: CRYPTO_RESTRICTED_JURISDICTIONS,
    },
  });
});

profileRoutes.patch("/me", async (c) => {
  const body = await parseJson(
    c,
    z.object({
      displayName: z.string().trim().min(2).max(40).optional(),
      privacyMode: z.enum(["progress_only", "amounts", "holdings"]).optional(),
      timezone: z.string().trim().min(1).max(64).optional(),
    }),
  );
  if (Object.keys(body).length === 0)
    throw new ApiError(422, "Choose something to update.");
  const userId = c.get("userId");
  // COALESCE, so a field that was not sent keeps its value. This used to write
  // the defaults for every omitted field — changing only the privacy mode reset
  // the display name to "Member XXXX" and the timezone to UTC.
  await c.env.DB.prepare(
    `INSERT INTO profiles (user_id, display_name, privacy_mode, timezone)
     VALUES (?1, COALESCE(?2, ?5), COALESCE(?3, 'progress_only'), COALESCE(?4, 'UTC'))
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = COALESCE(?2, display_name),
       privacy_mode = COALESCE(?3, privacy_mode),
       timezone = COALESCE(?4, timezone)`,
  )
    .bind(
      userId,
      body.displayName ?? null,
      body.privacyMode ?? null,
      body.timezone ?? null,
      `Member ${userId.slice(-4).toUpperCase()}`,
    )
    .run();
  const profile = await c.env.DB.prepare(
    "SELECT * FROM profiles WHERE user_id = ?",
  )
    .bind(userId)
    .first();
  return c.json({ profile: publicProfile(profile ?? {}) });
});

/**
 * Agree to the terms and confirm eligibility. Asked before the first purchase,
 * and again only if TERMS_VERSION rises. The terms and one statement must be sent
 * as `true` — the server records an explicit statement, never an absence of one:
 *
 * - `notRestricted`: not a U.S. person, not in any RESTRICTED_JURISDICTIONS.
 *   Needed for stocks and private markets, and covers crypto too, the longer list
 *   containing the shorter. The only statement app 1.1.0 knows.
 * - `notCryptoRestricted`: not in any CRYPTO_RESTRICTED_JURISDICTIONS. Enough
 *   for crypto alone.
 */
profileRoutes.post("/me/terms", async (c) => {
  const body = await parseJson(
    c,
    z
      .object({
        version: z.literal(TERMS_VERSION),
        acceptTerms: z.literal(true),
        notRestricted: z.literal(true).optional(),
        notCryptoRestricted: z.literal(true).optional(),
      })
      .refine((value) => value.notRestricted || value.notCryptoRestricted, {
        message: "Confirm where you live before buying.",
      }),
  );
  const securities = body.notRestricted === true;
  await c.env.DB.prepare(
    `UPDATE profiles
     SET terms_version = ?, terms_accepted_at = CURRENT_TIMESTAMP,
         securities_terms_version = CASE WHEN ? THEN ? ELSE securities_terms_version END
     WHERE user_id = ?`,
  )
    .bind(body.version, securities ? 1 : 0, body.version, c.get("userId"))
    .run();
  const profile = await c.env.DB.prepare(
    "SELECT securities_terms_version FROM profiles WHERE user_id = ?",
  )
    .bind(c.get("userId"))
    .first<{ securities_terms_version: number | null }>();
  return c.json({
    terms: {
      current: TERMS_VERSION,
      accepted: true,
      securitiesAccepted:
        Number(profile?.securities_terms_version ?? 0) >= TERMS_VERSION,
    },
  });
});

profileRoutes.post("/me/push-tokens", async (c) => {
  const body = await parseJson(
    c,
    z.object({
      token: z.string().min(8).max(512),
      platform: z.enum(["android", "ios"]),
    }),
  );
  await c.env.DB.prepare(
    `INSERT INTO push_tokens (id, user_id, token, platform) VALUES (?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, enabled = 1, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(id("push"), c.get("userId"), body.token, body.platform)
    .run();
  return c.json({ registered: true }, 201);
});

/**
 * Delete the account and everything KEPT holds about it.
 *
 * Almost every table cascades from "user", but two references do not: a circle's
 * owner and an invite's creator. Deleting the user row with those in place fails
 * the foreign key, so they are settled first —
 *
 *   a circle with other members   passes to the longest-standing of them
 *   a circle with nobody else     is deleted, with its feed
 *   invites the user created      are deleted; the links stop working
 *
 * What is NOT deleted, because KEPT never held it: the wallet, the tokens in it,
 * and the transactions on-chain. Those belong to the reader and stay where they
 * are.
 */
profileRoutes.delete("/me", async (c) => {
  const userId = c.get("userId");
  const owned = await c.env.DB.prepare(
    `SELECT c.id,
       (SELECT cm.user_id FROM circle_members cm
        WHERE cm.circle_id = c.id AND cm.user_id != ?1
        ORDER BY cm.joined_at ASC LIMIT 1) AS heir
     FROM circles c WHERE c.owner_user_id = ?1`,
  )
    .bind(userId)
    .all<{ id: string; heir: string | null }>();

  const statements: D1PreparedStatement[] = [];
  for (const circle of owned.results) {
    if (circle.heir) {
      statements.push(
        c.env.DB.prepare(
          "UPDATE circles SET owner_user_id = ? WHERE id = ?",
        ).bind(circle.heir, circle.id),
        c.env.DB.prepare(
          "UPDATE circle_members SET role = 'owner' WHERE circle_id = ? AND user_id = ?",
        ).bind(circle.id, circle.heir),
      );
    } else {
      statements.push(
        c.env.DB.prepare("DELETE FROM circles WHERE id = ?").bind(circle.id),
      );
    }
  }
  statements.push(
    c.env.DB.prepare("DELETE FROM invites WHERE created_by = ?").bind(userId),
    c.env.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(userId),
  );
  // One batch is one transaction: an account is either wholly gone or untouched.
  await c.env.DB.batch(statements);
  return c.body(null, 204);
});

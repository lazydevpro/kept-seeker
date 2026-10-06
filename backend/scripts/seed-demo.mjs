#!/usr/bin/env node
/**
 * Fills the LOCAL database with a realistic account so every screen has
 * something to show.
 *
 *   npm run db:seed:demo
 *
 * Seeds the most recently created profile — sign in on the app first, then run
 * this. Everything it writes is ordinary data flowing through the ordinary API:
 * no mock layer ships in the app, and deleting these rows restores an empty
 * account.
 *
 * The mints are REAL mainnet mints at their real 9 decimals, so the portfolio
 * prices them against live Jupiter quotes. Only the purchases themselves are
 * synthetic — a real holding needs a real on-chain buy.
 *
 * Local only: it talks to `wrangler d1 execute --local`, which cannot reach a
 * deployed database.
 *
 *   npm run db:seed:demo -- --circle-only
 *   npm run db:seed:demo -- --name Asha      (either mode; sets the account's name)
 *
 * Only the circle: three friends, their week and their posts. The account's own goal,
 * history and wallet are left as they are — for recording a new person's first week,
 * where onboarding sets the goal and the purchase is made on camera.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TAG = "demo"; // every row id is prefixed so the teardown is exact

const d1 = (args) =>
  execFileSync("npx", ["wrangler", "d1", "execute", "DB", "--local", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const query = (sql) => {
  const raw = d1(["--json", "--command", sql]);
  return JSON.parse(raw.slice(raw.indexOf("[")))[0].results;
};

const run = (sql) => {
  const file = join(tmpdir(), `kept-seed-${Date.now()}.sql`);
  writeFileSync(file, sql);
  try {
    d1(["--file", file]);
  } finally {
    unlinkSync(file);
  }
};

const q = (value) =>
  value === null ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;
const iso = (daysAgo, hour = 18) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};
/** Monday of the week `weeksAgo` back, as YYYY-MM-DD. */
const weekStart = (weeksAgo) => {
  const date = new Date();
  date.setUTCDate(
    date.getUTCDate() - ((date.getUTCDay() + 6) % 7) - weeksAgo * 7,
  );
  return date.toISOString().slice(0, 10);
};

// Real mainnet mints and their real decimals, so live quotes resolve.
const ASSETS = {
  tOpenAI: { mint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ", decimals: 9 },
  tKalshi: { mint: "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ", decimals: 9 },
};

// Pass a user id to target a specific account; otherwise the newest profile.
// The newest is not always the one your browser session is using — anonymous
// sign-in mints a new user whenever local storage is cleared — so the id is
// printed and `/v1/me` will tell you which one the app is actually on.
const args = process.argv.slice(2);
const circleOnly = args.includes("--circle-only");
// `--name Asha`: what the circle and the home greeting call this account.
const nameAt = args.indexOf("--name");
const displayName = nameAt >= 0 ? args[nameAt + 1] : undefined;
const owner =
  args.find((arg, index) => !arg.startsWith("--") && index !== nameAt + 1) ??
  query("SELECT user_id FROM profiles ORDER BY rowid DESC LIMIT 1;")[0]
    ?.user_id;
if (!owner) {
  console.error(
    "No profile found. Open the app and sign in once, then re-run.",
  );
  process.exit(1);
}
if (
  !query(`SELECT user_id FROM profiles WHERE user_id = ${q(owner)};`).length
) {
  console.error(
    `No profile for ${owner}. Check /v1/me for the id the app is using.`,
  );
  process.exit(1);
}
console.log(`Seeding demo data for ${owner}`);

const statements = [];
const add = (sql) => statements.push(sql);

if (displayName)
  add(
    `UPDATE profiles SET display_name = ${q(displayName)} WHERE user_id = ${q(owner)};`,
  );

// Wipe any previous run so this is repeatable.
add(`DELETE FROM reactions WHERE post_id LIKE '${TAG}_%';`);
add(`DELETE FROM activity_posts WHERE id LIKE '${TAG}_%';`);
add(`DELETE FROM circle_members WHERE circle_id LIKE '${TAG}_%';`);
add(`DELETE FROM circles WHERE id LIKE '${TAG}_%';`);
add(`DELETE FROM contributions WHERE id LIKE '${TAG}_%';`);
add(`DELETE FROM weekly_promises WHERE id LIKE '${TAG}_%';`);
add(`DELETE FROM goals WHERE id LIKE '${TAG}_%';`);
add(`DELETE FROM wallet_connections WHERE id LIKE '${TAG}_%';`);
add(`DELETE FROM profiles WHERE user_id LIKE '${TAG}_%';`);
add(`DELETE FROM "user" WHERE id LIKE '${TAG}_%';`);

const buys = [];
if (!circleOnly) {
  // Also clear whatever this account accumulated from onboarding, so the totals on
  // screen match the seeded story instead of mixing in a stray half-finished goal.
  // Local database only — the account itself and its session are left alone.
  add(`DELETE FROM contributions WHERE user_id = ${q(owner)};`);
  add(`DELETE FROM weekly_promises WHERE user_id = ${q(owner)};`);
  add(`DELETE FROM goals WHERE user_id = ${q(owner)};`);

  // A verified wallet, so the Invest review sheet shows its real signing state
  // rather than "Connect wallet".
  const wallet = "KeptDemoWa11etAddress1111111111111111111111";
  add(`INSERT INTO wallet_connections (id, user_id, address, chain, verified_at)
     VALUES ('${TAG}_wallet', ${q(owner)}, ${q(wallet)}, 'solana', CURRENT_TIMESTAMP);`);

  // Goal plus twelve weeks of history. The current week is left OPEN so the
  // "Keep this week" action is visible; the streak logic skips a week that is not
  // yet due, so the run still reads as eight.
  const goalId = `${TAG}_goal`;
  add(`INSERT INTO goals (id, user_id, title, target_type, target_value, visibility, status)
     VALUES ('${goalId}', ${q(owner)}, '12 weeks of showing up', 'weekly_consistency', 12, 'progress_only', 'active');`);

  const missed = new Set([9, 11]); // two early misses, so the grid is not a solid block
  for (let back = 11; back >= 0; back -= 1) {
    const open = back === 0 || missed.has(back);
    add(`INSERT INTO weekly_promises (id, goal_id, user_id, week_start, due_at, target_cents, completed_at)
       VALUES ('${TAG}_wp_${back}', '${goalId}', ${q(owner)}, ${q(weekStart(back))},
               ${q(iso(back * 7 - 2))}, 2500, ${open ? "NULL" : q(iso(back * 7 - 2, 19))});`);
  }

  // Purchases. Cost basis is set so one position is up and one is down against
  // today's real prices — a portfolio that is green everywhere teaches nothing.
  //
  // Amounts vary, because a run of identical figures renders the contributions
  // sparkline as a solid block, and real people do change what they put in. The
  // most recent buys are days old so "this month" is not empty.
  const AVG_OPENAI = 900; // below today's price, so this position shows a gain
  const AVG_KALSHI = 470; // above it, so this one shows a loss
  const buy = (symbol, daysAgo, usdc, avgPrice) => ({
    symbol,
    daysAgo,
    usdc,
    units: usdc / avgPrice,
  });

  buys.push(
    buy("tOpenAI", 66, 25, AVG_OPENAI),
    buy("tOpenAI", 59, 25, AVG_OPENAI),
    buy("tKalshi", 52, 25, AVG_KALSHI),
    buy("tOpenAI", 45, 50, AVG_OPENAI),
    buy("tOpenAI", 38, 25, AVG_OPENAI),
    buy("tKalshi", 31, 25, AVG_KALSHI),
    buy("tOpenAI", 24, 25, AVG_OPENAI),
    buy("tOpenAI", 17, 75, AVG_OPENAI),
    buy("tKalshi", 10, 25, AVG_KALSHI),
    buy("tOpenAI", 3, 25, AVG_OPENAI),
  );

  buys.forEach((buy, index) => {
    const asset = ASSETS[buy.symbol];
    const base = Math.round(buy.units * 10 ** asset.decimals);
    add(`INSERT INTO contributions
       (id, user_id, goal_id, wallet_address, signature, asset_symbol, asset_mint,
        amount_base_units, status, execution_mode, input_amount_usdc_base_units,
        verified_amount_base_units, asset_decimals, holdings_checked_at, occurred_at, verified_at)
       VALUES ('${TAG}_c${index}', ${q(owner)}, '${goalId}', ${q(wallet)}, ${q(`${TAG}sig${index}`)},
               ${q(buy.symbol)}, ${q(asset.mint)}, '${base}', 'verified', 'live',
               '${buy.usdc * 1_000_000}', '${base}', ${asset.decimals},
               CURRENT_TIMESTAMP, ${q(iso(buy.daysAgo))}, CURRENT_TIMESTAMP);`);
  });
}

// A circle with three other people, two of whom kept this week.
const circleId = `${TAG}_circle`;
add(`INSERT INTO circles (id, owner_user_id, name, description)
     VALUES ('${circleId}', ${q(owner)}, 'Slow Money Club', 'Four friends, one small promise a week.');`);
add(`INSERT INTO circle_members (circle_id, user_id, role)
     VALUES ('${circleId}', ${q(owner)}, 'owner');`);

const friends = [
  { id: `${TAG}_u1`, name: "Priya Raman", kept: true },
  { id: `${TAG}_u2`, name: "Marcus Bell", kept: true },
  { id: `${TAG}_u3`, name: "Sofia Lind", kept: false },
];
friends.forEach((friend, index) => {
  add(`INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES (${q(friend.id)}, ${q(friend.name)}, ${q(`${friend.id}@demo.local`)}, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`);
  add(`INSERT INTO profiles (user_id, display_name, privacy_mode)
       VALUES (${q(friend.id)}, ${q(friend.name)}, 'progress_only');`);
  add(`INSERT INTO circle_members (circle_id, user_id, role)
       VALUES ('${circleId}', ${q(friend.id)}, 'member');`);
  add(`INSERT INTO goals (id, user_id, title, target_type, target_value, visibility, status)
       VALUES ('${TAG}_goal_${index}', ${q(friend.id)}, 'Build my reserve', 'weekly_consistency', 12, 'progress_only', 'active');`);
  // Enough kept weeks to give each friend a distinct ring.
  const kept = [7, 5, 3][index];
  for (let back = 0; back < 12; back += 1) {
    const done = back < kept && (back > 0 || friend.kept);
    add(`INSERT INTO weekly_promises (id, goal_id, user_id, week_start, due_at, target_cents, completed_at)
         VALUES ('${TAG}_wp_${index}_${back}', '${TAG}_goal_${index}', ${q(friend.id)}, ${q(weekStart(back))},
                 ${q(iso(back * 7 - 2))}, 2500, ${done ? q(iso(back * 7 - 2, 19)) : "NULL"});`);
  }
});

// Encouragement, newest first in the feed.
const posts = [
  {
    id: `${TAG}_p1`,
    user: friends[0].id,
    body: "Week seven done. Slow and boring is working.",
    daysAgo: 1,
  },
  {
    id: `${TAG}_p2`,
    user: friends[1].id,
    body: "Nearly skipped this one. Glad I didn't.",
    daysAgo: 3,
  },
];
posts.forEach((post) => {
  add(`INSERT INTO activity_posts (id, circle_id, user_id, kind, body, created_at)
       VALUES (${q(post.id)}, '${circleId}', ${q(post.user)}, 'promise_kept', ${q(post.body)}, ${q(iso(post.daysAgo))});`);
});
[
  { post: posts[0].id, user: owner, emoji: "👏" },
  { post: posts[0].id, user: friends[1].id, emoji: "🔥" },
  { post: posts[1].id, user: owner, emoji: "🙌" },
].forEach((reaction) => {
  add(`INSERT INTO reactions (post_id, user_id, emoji)
       VALUES (${q(reaction.post)}, ${q(reaction.user)}, ${q(reaction.emoji)});`);
});

run(statements.join("\n"));

const cost = buys.reduce((sum, buy) => sum + buy.usdc, 0);
if (circleOnly) {
  console.log(`
  circle          Slow Money Club, 4 members, 2 posts
  your account    goal, history and wallet untouched
`);
  process.exit(0);
}
console.log(`
  goal            12 weeks of showing up
  promises        12 weeks, 9 kept, this week still open
  purchases       ${buys.length} verified live buys, $${cost} cost basis
  positions       tOpenAI, tKalshi (real mints, priced live)
  circle          Slow Money Club, 4 members, 2 posts
  wallet          verified

Open the app. Run scripts/seed-demo.mjs again to reset, or:
  npx wrangler d1 execute DB --local --command "DELETE FROM contributions WHERE id LIKE '${TAG}_%';"
`);

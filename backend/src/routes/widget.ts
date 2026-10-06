import { Hono } from "hono";
import type { AppEnv, Variables } from "../types";

export const widgetRoutes = new Hono<{
  Bindings: AppEnv;
  Variables: Variables;
}>();

widgetRoutes.get("/snapshot", async (c) => {
  const userId = c.get("userId");
  const [goal, circle, promises, contributions, rehearsals] =
    await c.env.DB.batch([
      c.env.DB.prepare(
        `SELECT g.title, g.target_value,
        COUNT(w.id) AS total,
        SUM(CASE WHEN w.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS complete
       FROM goals g LEFT JOIN weekly_promises w ON w.goal_id = g.id
       WHERE g.user_id = ? AND g.status = 'active' GROUP BY g.id ORDER BY g.created_at DESC LIMIT 1`,
      ).bind(userId),
      c.env.DB.prepare(
        `SELECT COUNT(DISTINCT cm.user_id) AS members,
        COUNT(DISTINCT CASE WHEN wp.completed_at IS NOT NULL AND wp.week_start >= date('now', '-7 days') THEN cm.user_id END) AS showed_up
       FROM circle_members mine JOIN circle_members cm ON cm.circle_id = mine.circle_id
       LEFT JOIN weekly_promises wp ON wp.user_id = cm.user_id
       WHERE mine.user_id = ?`,
      ).bind(userId),
      c.env.DB.prepare(
        `SELECT week_start, completed_at, due_at, target_cents FROM weekly_promises
       WHERE user_id = ? ORDER BY week_start DESC LIMIT 40`,
      ).bind(userId),
      // Live and rehearsed money are queried separately and never summed together.
      // A devnet rehearsal writes the intended USDC amount but spends nothing, so
      // counting both in one figure reports money that was never moved.
      //
      // `direction = 'buy'` is load-bearing. Sells share this table and store their
      // PROCEEDS in the same `input_amount_usdc_base_units` column, so without it a
      // sale would be added to "put in this month" and drawn as a bar — the widget
      // would report money leaving as money arriving.
      c.env.DB.prepare(
        `SELECT asset_symbol, execution_mode, input_amount_usdc_base_units, occurred_at, created_at
       FROM contributions WHERE user_id = ? AND status = 'verified' AND execution_mode = 'live'
         AND direction = 'buy'
       ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT 12`,
      ).bind(userId),
      c.env.DB.prepare(
        `SELECT asset_symbol, execution_mode, input_amount_usdc_base_units, occurred_at, created_at
       FROM contributions WHERE user_id = ? AND status = 'verified' AND execution_mode = 'sandbox'
         AND direction = 'buy'
       ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT 12`,
      ).bind(userId),
    ]);
  const activeGoal = goal.results[0] as Record<string, unknown> | undefined;
  const circleStats = circle.results[0] as Record<string, unknown> | undefined;
  const complete = Number(activeGoal?.complete ?? 0);
  const target = Math.max(1, Number(activeGoal?.target_value ?? 12));
  const members = Math.max(1, Number(circleStats?.members ?? 1));
  const showedUp = Number(circleStats?.showed_up ?? 0);
  const promiseRows = promises.results as Array<Record<string, unknown>>;
  // The current week is open until its due date passes, so it must not count as
  // a miss. Without this the streak read 0 from Monday morning until the moment
  // the week was kept — an eight week run looked like nothing had ever happened.
  let streak = 0;
  for (const row of promiseRows) {
    if (!row.completed_at) {
      const stillOpen = row.due_at
        ? new Date(String(row.due_at)) > new Date()
        : false;
      if (stillOpen) continue;
      break;
    }
    streak += 1;
  }
  const contributionRows = contributions.results as Array<
    Record<string, unknown>
  >;
  const rehearsalRows = rehearsals.results as Array<Record<string, unknown>>;
  const usd = (row: Record<string, unknown>) =>
    Number(row.input_amount_usdc_base_units ?? 0) / 1_000_000;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const inThisMonth = (row: Record<string, unknown>) =>
    String(row.occurred_at ?? row.created_at).startsWith(thisMonth);
  const monthTotal = (rows: Array<Record<string, unknown>>) =>
    rows.filter(inThisMonth).reduce((sum, row) => sum + usd(row), 0);

  // The most recent of either stream, so a devnet-only account still has
  // something to show. It carries its own `mode` for the caller to label.
  const latest = [...contributionRows, ...rehearsalRows].sort((a, b) =>
    String(b.occurred_at ?? b.created_at).localeCompare(
      String(a.occurred_at ?? a.created_at),
    ),
  )[0];
  const awardWeeks =
    [52, 26, 12, 8, 4, 1].find((weeks) => streak >= weeks) ?? 0;
  /*
   * The promise ring is THIS week: full once it is kept, empty until then, and empty
   * again when the next week starts. It used to be weeks-kept over the target — the
   * goal ring's number drawn twice — so it never reset, and home said "Open" and kept
   * offering "Keep this week" after the week was kept. The current week is the newest
   * one that has started; a missed week stays empty rather than showing as kept.
   */
  const today = new Date().toISOString().slice(0, 10);
  const currentWeek = promiseRows.find(
    (row) => String(row.week_start) <= today,
  );
  const promiseKept = currentWeek?.completed_at ? 1 : 0;
  return c.json({
    snapshot: {
      title: String(activeGoal?.title ?? "Build your reserve"),
      message:
        complete > 0
          ? `${complete} promises kept`
          : "Your next promise is waiting",
      rings: {
        consistency: promiseKept,
        circle: Math.min(1, showedUp / members),
        goal: Math.min(1, complete / target),
      },
      updatedAt: new Date().toISOString(),
      privacy: "progress_only",
      summary: {
        goal: {
          title: String(activeGoal?.title ?? "Build your reserve"),
          complete,
          target,
        },
        circle: { members, showedUp },
        consistency: {
          kept: promiseRows.filter((row) => Boolean(row.completed_at)).length,
          total: promiseRows.length,
          streak,
          weeks: promiseRows
            .slice(0, 12)
            .reverse()
            .map((row) => Boolean(row.completed_at)),
        },
        contributions: {
          monthUsd: monthTotal(contributionRows),
          recentUsd: contributionRows.slice(0, 8).reverse().map(usd),
          rehearsedMonthUsd: monthTotal(rehearsalRows),
          rehearsedRecentUsd: rehearsalRows.slice(0, 8).reverse().map(usd),
        },
        latest: latest
          ? {
              amountUsd: usd(latest),
              symbol: String(latest.asset_symbol ?? "Investment"),
              occurredAt: String(latest.occurred_at ?? latest.created_at),
              mode: String(latest.execution_mode ?? "live"),
            }
          : null,
        awardWeeks,
      },
    },
  });
});

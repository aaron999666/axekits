import { Env, BillingMessage, CleanupMessage } from "./types";
import { cleanExpiredR2Files } from "./r2";

export async function handleQueue(
  batch: MessageBatch<BillingMessage | CleanupMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const body = message.body;

      if ("type" in body && body.type === "consumption") {
        await env.DB.prepare(
          "INSERT INTO transactions (user_id, type, points_amount, tool_id, description) VALUES (?, 'consumption', ?, ?, ?)"
        )
          .bind(body.userId, body.pointsCost, body.toolId, `Used tool: ${body.toolId}`)
          .run();

        await env.DB.prepare(
          "UPDATE tools_stats SET click_count = click_count + 1, revenue_total = revenue_total + ?, last_clicked_at = unixepoch() WHERE tool_id = ?"
        )
          .bind(body.pointsCost, body.toolId)
          .run();

        const exists = await env.DB.prepare(
          "SELECT tool_id FROM tools_stats WHERE tool_id = ?"
        )
          .bind(body.toolId)
          .first();

        if (!exists) {
          await env.DB.prepare(
            "INSERT INTO tools_stats (tool_id, click_count, revenue_total, last_clicked_at) VALUES (?, 1, ?, unixepoch())"
          )
            .bind(body.toolId, body.pointsCost)
            .run();
        }
      }

      if ("keys" in body) {
        for (const key of body.keys) {
          await env.R2.delete(key);
          await env.DB.prepare("DELETE FROM r2_files WHERE key = ?")
            .bind(key)
            .run();
        }
      }

      message.ack();
    } catch (err) {
      console.error("Queue error:", err);
      message.retry();
    }
  }
}

export async function handleScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  ctx.waitUntil(handleCronTasks(env));
}

async function handleCronTasks(env: Env): Promise<void> {
  const cleaned = await cleanExpiredR2Files(env);
  if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} expired R2 files`);
  }

  const twoDaysAgo = Math.floor(Date.now() / 1000) - 172800;
  await env.DB.prepare("DELETE FROM free_usage WHERE used_at < ?")
    .bind(twoDaysAgo)
    .run();
}

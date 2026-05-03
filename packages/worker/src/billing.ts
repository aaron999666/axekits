import { Env, JWTPayload, BillingMessage } from "./types";
import { signJWT, revokeJWT } from "./auth";

export interface DeductResult {
  success: boolean;
  newBalance: number;
  usedFreeQuota: boolean;
  newToken?: string;
  oldJti?: string;
}

export async function deductPoints(
  user: JWTPayload,
  toolId: string,
  pointsCost: number,
  env: Env
): Promise<DeductResult> {
  if (user.points >= pointsCost) {
    const result = await env.DB.prepare(
      "UPDATE users SET points_balance = points_balance - ?, updated_at = unixepoch() WHERE id = ? AND points_balance >= ? RETURNING points_balance"
    )
      .bind(pointsCost, user.sub, pointsCost)
      .first<{ points_balance: number }>();

    if (result) {
      const newToken = await signJWT(
        { sub: user.sub, email: user.email, points: result.points_balance, tier: user.tier },
        env
      );

      await env.BILLING_QUEUE.send({
        userId: user.sub,
        toolId,
        pointsCost,
        type: "consumption",
        timestamp: Math.floor(Date.now() / 1000),
      } satisfies BillingMessage);

      return {
        success: true,
        newBalance: result.points_balance,
        usedFreeQuota: false,
        newToken,
        oldJti: user.jti,
      };
    }
  }

  const freeResult = await checkFreeQuota(user.sub, env);
  if (freeResult.available) {
    await env.DB.prepare(
      "INSERT INTO free_usage (user_id, tool_id) VALUES (?, ?)"
    )
      .bind(user.sub, toolId)
      .run();

    return { success: true, newBalance: user.points, usedFreeQuota: true };
  }

  return { success: false, newBalance: user.points, usedFreeQuota: false };
}

async function checkFreeQuota(
  userId: string,
  env: Env
): Promise<{ available: boolean; remaining: number }> {
  const todayStart = Math.floor(Date.now() / 1000) - (Math.floor(Date.now() / 1000) % 86400);
  const result = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM free_usage WHERE user_id = ? AND used_at >= ?"
  )
    .bind(userId, todayStart)
    .first<{ count: number }>();

  const limit = parseInt(env.FREE_DAILY_LIMIT);
  const used = result?.count || 0;
  return { available: used < limit, remaining: Math.max(0, limit - used) };
}

export async function getFreeQuotaRemaining(
  userId: string,
  env: Env
): Promise<number> {
  const { remaining } = await checkFreeQuota(userId, env);
  return remaining;
}

export async function refreshJWTBalance(
  user: JWTPayload,
  env: Env
): Promise<string> {
  const result = await env.DB.prepare(
    "SELECT points_balance, tier FROM users WHERE id = ?"
  )
    .bind(user.sub)
    .first<{ points_balance: number; tier: string }>();

  if (!result) throw new Error("User not found");

  await revokeJWT(user.jti, user.exp, env);

  return signJWT(
    { sub: user.sub, email: user.email, points: result.points_balance, tier: result.tier },
    env
  );
}

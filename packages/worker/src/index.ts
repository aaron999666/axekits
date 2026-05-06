import { Env, JWTPayload, BillingMessage, CleanupMessage } from "./types";
import { verifyJWT, parseCookieToken, signJWT, refreshJWTBalance, revokeJWT } from "./auth";
import { deductPoints, getFreeQuotaRemaining } from "./billing";
import { parseIntent } from "./ai";
import { handleStripeWebhook, createCheckoutSession } from "./stripe";
import { createUploadUrl, uploadFile, getSharedFile } from "./r2";
import { handleQueue, handleScheduled } from "./cron";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (url.pathname === "/api/health") {
        writeAnalytics(env, "health", "ok", 1);
        return json({ status: "ok", timestamp: Date.now() }, 200, corsHeaders);
      }

      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        return handleRegister(request, env, corsHeaders);
      }

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        return handleLogin(request, env, corsHeaders);
      }

      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        return withAuth(request, env, corsHeaders, async (user) => {
          const row = await env.DB.prepare(
            "SELECT id, email, points_balance, tier FROM users WHERE id = ?"
          ).bind(user.sub).first<{ id: string; email: string; points_balance: number; tier: string }>();
          if (!row) return json({ error: "User not found" }, 404, corsHeaders);
          const freeRemaining = await getFreeQuotaRemaining(user.sub, env);
          return json({
            id: row.id,
            email: row.email,
            balance: row.points_balance,
            tier: row.tier,
            free_remaining: freeRemaining,
          }, 200, corsHeaders);
        });
      }

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        return withAuth(request, env, corsHeaders, async (user) => {
          await revokeJWT(user.jti, user.exp, env);
          return new Response(
            JSON.stringify({ success: true }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Set-Cookie": "access_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
              },
            }
          );
        });
      }

      if (url.pathname === "/api/admin/bootstrap" && request.method === "POST") {
        const provided = request.headers.get("x-admin-bootstrap-key") || "";
        if (!env.ADMIN_BOOTSTRAP_KEY || provided !== env.ADMIN_BOOTSTRAP_KEY) {
          return json({ error: "Forbidden" }, 403, corsHeaders);
        }
        const { email } = (await request.json()) as { email: string };
        if (!email || !isValidEmail(email)) return json({ error: "Valid email required" }, 400, corsHeaders);

        const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
        if (!user) return json({ error: "User not found. Register first." }, 404, corsHeaders);

        const existing = await env.DB.prepare("SELECT COUNT(*) AS c FROM admin_users").first<{ c: number }>();
        if ((existing?.c || 0) > 0) {
          return json({ error: "Bootstrap already completed" }, 409, corsHeaders);
        }

        await env.DB.prepare(
          "INSERT INTO admin_users (user_id, role, active) VALUES (?, 'super_admin', 1)"
        ).bind(user.id).run();

        return json({ success: true, user_id: user.id, role: "super_admin" }, 201, corsHeaders);
      }

      if (url.pathname === "/api/auth/turnstile" && request.method === "POST") {
        return handleTurnstile(request, env, corsHeaders);
      }

      if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
        return handleStripeWebhook(request, env);
      }

      if (url.pathname === "/api/stripe/checkout" && request.method === "POST") {
        return withAuth(request, env, corsHeaders, async (user) => {
          const { priceId } = (await request.json()) as { priceId: string };
          const checkoutUrl = await createCheckoutSession(user.sub, priceId, env);
          return json({ url: checkoutUrl }, 200, corsHeaders);
        });
      }

      if (url.pathname === "/api/tools" && request.method === "GET") {
        return handleToolsList(env, url, corsHeaders);
      }

      if (url.pathname.startsWith("/api/tools/") && request.method === "POST") {
        const toolId = url.pathname.split("/api/tools/")[1];
        if (!toolId) return json({ error: "Invalid tool ID" }, 400, corsHeaders);

        const tools = await getToolsFromCache(env);
        const tool = tools.find((t) => t.id === toolId);
        if (!tool) return json({ error: "Tool not found" }, 404, corsHeaders);

        if (tool.health_status === "down") {
          return json({ error: "Tool temporarily unavailable" }, 503, corsHeaders);
        }

        const toolUrl = tool.self_hosted
          ? `${env.APP_ORIGIN}/tools-app/${tool.category}/${tool.id}/`
          : tool.demo_url;

        // Free tools can be used without login.
        if ((tool.points_cost || 0) <= 0) {
          writeAnalytics(env, "tool_use", "free", 1);
          return json({
            tool_url: toolUrl,
            sandbox_config: {
              allow_scripts: true,
              allow_forms: true,
              self_hosted: tool.self_hosted,
            },
            billing: { mode: "free", points_cost: 0 },
          }, 200, corsHeaders);
        }

        return withAuth(request, env, corsHeaders, async (user) => {
          const result = await deductPoints(user, toolId, tool.points_cost, env);

          if (!result.success) {
            return json({ error: "Insufficient points", balance: result.newBalance }, 403, corsHeaders);
          }

          const responseHeaders: Record<string, string> = {
            ...corsHeaders,
            "Content-Type": "application/json",
          };

          if (result.newToken) {
            responseHeaders["Set-Cookie"] = buildCookie(result.newToken);
          }

          writeAnalytics(env, "tool_use", "paid", tool.points_cost);

          return new Response(
            JSON.stringify({
              tool_url: toolUrl,
              sandbox_config: {
                allow_scripts: true,
                allow_forms: true,
                self_hosted: tool.self_hosted,
              },
              balance: result.newBalance,
              used_free_quota: result.usedFreeQuota,
              billing: { mode: "points", points_cost: tool.points_cost },
            }),
            { status: 200, headers: responseHeaders }
          );
        });
      }

      if (url.pathname === "/api/ai/intent" && request.method === "POST") {
        return withAuth(request, env, corsHeaders, async (user) => {
          const { message } = (await request.json()) as { message: string };
          if (!message) return json({ error: "Message required" }, 400, corsHeaders);

          const intent = await parseIntent(message, env);
          return json(intent, 200, corsHeaders);
        });
      }

      if (url.pathname === "/api/ai/providers" && request.method === "GET") {
        return withAuth(request, env, corsHeaders, async () => {
          return json(
            {
              order: (env.AI_PROVIDER_ORDER || "gemini,cloudflare,mimo,deepseek")
                .split(",")
                .map((s) => s.trim()),
              configured: {
                gemini: Boolean(env.GEMINI_API_KEY),
                cloudflare: Boolean(env.CF_API_TOKEN && env.CF_ACCOUNT_ID),
                mimo: Boolean(env.MIMO_API_KEY && env.MIMO_API_BASE),
                deepseek: Boolean(env.DEEPSEEK_API_KEY),
              },
              models: {
                gemini: env.GEMINI_MODEL || "gemini-1.5-flash",
                cloudflare: env.CF_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct",
                mimo: env.MIMO_MODEL || "mimo-chat",
                deepseek: env.DEEPSEEK_MODEL || "deepseek-chat",
              },
            },
            200,
            corsHeaders
          );
        });
      }

      if (url.pathname === "/api/user/balance" && request.method === "GET") {
        return withAuth(request, env, corsHeaders, async (user) => {
          const newToken = await refreshJWTBalance(user, env);
          const result = await env.DB.prepare(
            "SELECT points_balance, tier FROM users WHERE id = ?"
          )
            .bind(user.sub)
            .first<{ points_balance: number; tier: string }>();

          const freeRemaining = await getFreeQuotaRemaining(user.sub, env);

          return new Response(
            JSON.stringify({
              balance: result?.points_balance || 0,
              tier: result?.tier || "free",
              free_remaining: freeRemaining,
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Set-Cookie": buildCookie(newToken),
              },
            }
          );
        });
      }

      if (url.pathname === "/api/admin/overview" && request.method === "GET") {
        return withAdmin(request, env, corsHeaders, ["super_admin", "ops_admin", "finance_admin", "viewer"], async (admin) => {
          const users = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first<{ c: number }>();
          const paidUsers = await env.DB.prepare(
            "SELECT COUNT(*) AS c FROM users WHERE tier IN ('basic','pro','enterprise')"
          ).first<{ c: number }>();
          const tx24h = await env.DB.prepare(
            "SELECT COUNT(*) AS c FROM transactions WHERE created_at >= unixepoch() - 86400"
          ).first<{ c: number }>();
          const rev24h = await env.DB.prepare(
            "SELECT COALESCE(SUM(points_amount),0) AS s FROM transactions WHERE type='purchase' AND created_at >= unixepoch() - 86400"
          ).first<{ s: number }>();
          const unhealthy = await env.DB.prepare(
            "SELECT COUNT(*) AS c FROM tools_stats WHERE health_status IN ('degraded','down')"
          ).first<{ c: number }>();

          await writeAuditLog(env, admin, "view_overview", "dashboard", "global", {});

          return json({
            users_total: users?.c || 0,
            users_paid: paidUsers?.c || 0,
            transactions_24h: tx24h?.c || 0,
            purchase_points_24h: rev24h?.s || 0,
            unhealthy_tools: unhealthy?.c || 0,
          }, 200, corsHeaders);
        });
      }

      if (url.pathname === "/api/admin/audit" && request.method === "GET") {
        return withAdmin(request, env, corsHeaders, ["super_admin", "ops_admin", "finance_admin", "viewer"], async () => {
          const rows = await env.DB.prepare(
            "SELECT id, actor_user_id, actor_role, action, target_type, target_id, detail_json, created_at FROM admin_audit_logs ORDER BY id DESC LIMIT 200"
          ).all();
          return json({ items: rows.results || [] }, 200, corsHeaders);
        });
      }

      if (url.pathname.startsWith("/api/admin/tools/") && request.method === "POST") {
        return withAdmin(request, env, corsHeaders, ["super_admin", "ops_admin"], async (admin) => {
          const toolId = url.pathname.split("/api/admin/tools/")[1];
          if (!toolId) return json({ error: "Invalid tool ID" }, 400, corsHeaders);
          const body = (await request.json()) as { action?: "quarantine" | "restore"; reason?: string };
          const action = body.action || "quarantine";
          const reason = body.reason || "";

          const health = action === "quarantine" ? "down" : "healthy";
          await env.DB.prepare(
            "INSERT INTO tools_stats (tool_id, health_status, click_count, workflow_use_count, revenue_total, last_checked_at) VALUES (?, ?, 0, 0, 0, unixepoch()) ON CONFLICT(tool_id) DO UPDATE SET health_status=excluded.health_status, last_checked_at=unixepoch()"
          ).bind(toolId, health).run();
          await env.CACHE_KV.delete("tools:all");

          await writeAuditLog(env, admin, `tool_${action}`, "tool", toolId, { reason });
          return json({ success: true, tool_id: toolId, new_status: health }, 200, corsHeaders);
        });
      }

      if (url.pathname === "/api/r2/upload-url" && request.method === "POST") {
        return withAuth(request, env, corsHeaders, async (user) => {
          const { fileName, contentType, size } = (await request.json()) as {
            fileName: string; contentType: string; size: number;
          };

          const result = await createUploadUrl(user.sub, fileName, contentType, size, env);
          if (!result) return json({ error: "File too large" }, 413, corsHeaders);

          return json(result, 200, corsHeaders);
        });
      }

      if (url.pathname.startsWith("/api/r2/upload/") && request.method === "PUT") {
        return withAuth(request, env, corsHeaders, async (user) => {
          const key = decodeURIComponent(url.pathname.split("/api/r2/upload/")[1]);
          const body = await request.arrayBuffer();
          const contentType = request.headers.get("Content-Type") || "application/octet-stream";
          const success = await uploadFile(user.sub, key, body, contentType, env);

          if (!success) return json({ error: "Unauthorized" }, 403, corsHeaders);
          return json({ success: true, key }, 200, corsHeaders);
        });
      }

      if (url.pathname.startsWith("/api/r2/share/") && request.method === "GET") {
        const shareToken = url.pathname.split("/api/r2/share/")[1];
        const result = await getSharedFile(shareToken, env);

        if (!result) return json({ error: "Not found or expired" }, 404, corsHeaders);

        return new Response(result.body, {
          headers: {
            "Content-Type": result.contentType,
            "Content-Disposition": `attachment; filename="${result.fileName}"`,
            "Cache-Control": "private, max-age=3600",
          },
        });
      }

      if (url.pathname === "/api/workflows" && request.method === "GET") {
        return handleWorkflowsList(env, corsHeaders);
      }

      return json({ error: "Not found" }, 404, corsHeaders);
    } catch (err) {
      console.error("Worker error:", err);
      return json({ error: "Internal server error" }, 500, corsHeaders);
    }
  },

  queue: handleQueue,
  scheduled: handleScheduled,
};

async function withAuth(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  handler: (user: JWTPayload) => Promise<Response>
): Promise<Response> {
  const token = parseCookieToken(request);
  if (!token) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const user = await verifyJWT(token, env);
  if (!user) return json({ error: "Invalid or expired token" }, 401, corsHeaders);

  try {
    return await handler(user);
  } catch (err) {
    console.error("Handler error:", err);
    return json({ error: "Internal error" }, 500, corsHeaders);
  }
}

async function handleRegister(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { email, turnstileToken } = (await request.json()) as { email: string; turnstileToken?: string };
  if (!email) return json({ error: "Email required" }, 400, corsHeaders);
  if (!isValidEmail(email)) return json({ error: "Invalid email format" }, 400, corsHeaders);
  if (!(await validateTurnstileIfRequired(turnstileToken, env))) {
    return json({ error: "Turnstile verification required" }, 403, corsHeaders);
  }

  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      "INSERT INTO users (id, email) VALUES (?, ?)"
    )
      .bind(id, email)
      .run();
  } catch (e: unknown) {
    const msg = (e as Error).message || "";
    if (msg.includes("UNIQUE")) {
      return json({ error: "Email already registered" }, 409, corsHeaders);
    }
    throw e;
  }

  const token = await signJWT({ sub: id, email, points: 0, tier: "free" }, env);
  writeAnalytics(env, "auth_register", "success", 1);

  return new Response(
    JSON.stringify({ success: true, userId: id }),
    {
      status: 201,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Set-Cookie": buildCookie(token),
      },
    }
  );
}

async function handleLogin(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { email, turnstileToken } = (await request.json()) as { email: string; turnstileToken?: string };
  if (!email) return json({ error: "Email required" }, 400, corsHeaders);
  if (!isValidEmail(email)) return json({ error: "Invalid email format" }, 400, corsHeaders);
  if (!(await validateTurnstileIfRequired(turnstileToken, env))) {
    return json({ error: "Turnstile verification required" }, 403, corsHeaders);
  }

  const user = await env.DB.prepare(
    "SELECT id, email, points_balance, tier FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: string; email: string; points_balance: number; tier: string }>();

  if (!user) return json({ error: "User not found" }, 404, corsHeaders);

  const token = await signJWT(
    { sub: user.id, email: user.email, points: user.points_balance, tier: user.tier },
    env
  );
  writeAnalytics(env, "auth_login", "success", 1);

  return new Response(
    JSON.stringify({ success: true, userId: user.id }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Set-Cookie": buildCookie(token),
      },
    }
  );
}

async function handleTurnstile(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { token } = (await request.json()) as { token: string };

  const verifyResponse = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
      }).toString(),
    }
  );

  const result = (await verifyResponse.json()) as { success: boolean };
  if (!result.success) {
    return json({ error: "Verification failed" }, 403, corsHeaders);
  }

  return json({ verified: true }, 200, corsHeaders);
}

async function handleToolsList(
  env: Env,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const category = url.searchParams.get("category");
  const cacheKey = category ? `tools:cat:${category}` : "tools:all";

  const cached = await env.CACHE_KV.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
    });
  }

  const toolsUrl = env.TOOLS_DATA_URL;
  const response = await fetch(toolsUrl, { cf: { cacheTtl: 300 } });
  let tools = (await response.json()) as import("./types").ToolMeta[];

  if (category) {
    tools = tools.filter((t) => t.category === category);
  }

  tools = tools.filter((t) => t.health_status !== "down");

  const body = JSON.stringify(tools);
  await env.CACHE_KV.put(cacheKey, body, { expirationTtl: 300 });

  return new Response(body, {
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
  });
}

async function getToolsFromCache(env: Env): Promise<import("./types").ToolMeta[]> {
  const cached = await env.CACHE_KV.get("tools:all");
  if (cached) return JSON.parse(cached);

  const toolsUrl = env.TOOLS_DATA_URL;
  const response = await fetch(toolsUrl, { cf: { cacheTtl: 300 } });
  const tools: import("./types").ToolMeta[] = await response.json();
  await env.CACHE_KV.put("tools:all", JSON.stringify(tools), { expirationTtl: 300 });
  return tools;
}

async function handleWorkflowsList(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const cached = await env.CACHE_KV.get("workflows:all");
  if (cached) {
    return new Response(cached, {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
    });
  }

  const workflowsUrl = env.WORKFLOWS_DATA_URL;
  const response = await fetch(workflowsUrl, { cf: { cacheTtl: 300 } });
  const body = await response.text();
  await env.CACHE_KV.put("workflows:all", body, { expirationTtl: 300 });

  return new Response(body, {
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
  });
}

function buildCookie(token: string): string {
  return `access_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900`;
}

type AdminRole = "super_admin" | "ops_admin" | "finance_admin" | "viewer";

interface AdminContext {
  userId: string;
  role: AdminRole;
}

async function withAdmin(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  allowed: AdminRole[],
  handler: (admin: AdminContext) => Promise<Response>
): Promise<Response> {
  return withAuth(request, env, corsHeaders, async (user) => {
    const admin = await env.DB.prepare(
      "SELECT user_id, role, active FROM admin_users WHERE user_id = ?"
    ).bind(user.sub).first<{ user_id: string; role: AdminRole; active: number }>();

    if (!admin || admin.active !== 1) return json({ error: "Forbidden" }, 403, corsHeaders);
    if (!allowed.includes(admin.role)) return json({ error: "Insufficient role" }, 403, corsHeaders);
    return handler({ userId: admin.user_id, role: admin.role });
  });
}

async function writeAuditLog(
  env: Env,
  admin: AdminContext,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown>
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO admin_audit_logs (actor_user_id, actor_role, action, target_type, target_id, detail_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(admin.userId, admin.role, action, targetType, targetId, JSON.stringify(detail)).run();
}

function getCorsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.APP_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

function json(
  data: Record<string, unknown>,
  status = 200,
  corsHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(corsHeaders || {}) },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function validateTurnstileIfRequired(token: string | undefined, env: Env): Promise<boolean> {
  if ((env.TURNSTILE_ENFORCE || "").toLowerCase() !== "true") return true;
  if (!token) return false;
  try {
    const verifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: token,
        }).toString(),
      }
    );
    const result = (await verifyResponse.json()) as { success?: boolean };
    return Boolean(result.success);
  } catch {
    return false;
  }
}

function writeAnalytics(env: Env, event: string, outcome: string, value: number): void {
  try {
    if (!env.ANALYTICS) return;
    env.ANALYTICS.writeDataPoint({
      indexes: [event, outcome],
      doubles: [value],
      blobs: [new Date().toISOString()],
    });
  } catch {}
}

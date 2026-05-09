import { Env } from "./types";

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("Stripe-Signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: StripeEvent;
  try {
    event = await verifyStripeWebhook(body, signature, env);
  } catch (err) {
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  if (!event.id) return new Response("Invalid event payload", { status: 400 });

  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO stripe_webhook_events (id, event_type) VALUES (?, ?)"
  )
    .bind(event.id, event.type)
    .run();
  if (!inserted.success) return new Response("DB error", { status: 500 });

  const alreadyHandled = inserted.meta.changes === 0;
  if (alreadyHandled) return jsonResponse({ received: true, duplicate: true });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as StripeCheckoutSession;
      const userId = session.client_reference_id;
      const pointsPurchased = parseInt(session.metadata?.points || "0");
      if (!userId || !pointsPurchased) break;

      await env.DB.prepare(
        "UPDATE users SET points_balance = points_balance + ?, updated_at = unixepoch() WHERE id = ?"
      )
        .bind(pointsPurchased, userId)
        .run();

      await env.DB.prepare(
        "INSERT INTO transactions (user_id, type, points_amount, stripe_session_id, description) VALUES (?, 'purchase', ?, ?, ?)"
      )
        .bind(userId, pointsPurchased, session.id, `Purchased ${pointsPurchased} points`)
        .run();
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as StripeCharge;
      const userId = charge.metadata?.user_id;
      if (!userId) break;

      const originPoints = parseInt(charge.metadata?.points || "0");
      if (!originPoints || charge.amount <= 0) break;

      const refundPoints = Math.floor((charge.amount_refunded / charge.amount) * originPoints);
      if (refundPoints <= 0) break;

      await env.DB.prepare(
        "UPDATE users SET points_balance = points_balance - ?, updated_at = unixepoch() WHERE id = ? AND points_balance >= ?"
      )
        .bind(refundPoints, userId, refundPoints)
        .run();

      await env.DB.prepare(
        "INSERT INTO transactions (user_id, type, points_amount, description) VALUES (?, 'refund', ?, ?)"
      )
        .bind(userId, refundPoints, `Refund for charge ${charge.id}`)
        .run();
      break;
    }
  }

  return jsonResponse({ received: true });
}

async function verifyStripeWebhook(body: string, signature: string, env: Env): Promise<StripeEvent> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const parts = signature.split(",");
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v;
    if (k === "v1") signatures.push(v);
  }

  if (!timestamp || signatures.length === 0) throw new Error("Invalid signature format");

  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (timestampAge > 300) throw new Error("Timestamp too old");

  const signedPayload = `${timestamp}.${body}`;
  const expectedSig = arrayBufferToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload)));
  const valid = signatures.some((sig) => sig === expectedSig);
  if (!valid) throw new Error("Invalid signature");

  return JSON.parse(body) as StripeEvent;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createCheckoutSession(userId: string, priceId: string, env: Env): Promise<string> {
  const priceMap: Record<string, { points: string; name: string }> = {
    [env.STRIPE_PRICE_BASIC]: { points: "600", name: "50 CNY Pack" },
    [env.STRIPE_PRICE_PRO]: { points: "1400", name: "100 CNY Pack" },
    // Legacy fallback: if old third price is still passed, treat it as Basic.
    [env.STRIPE_PRICE_PACK_100]: { points: "600", name: "Legacy Basic Alias" },
  };
  const priceInfo = priceMap[priceId];
  if (!priceInfo) throw new Error("Unknown Stripe price id");

  const providers = resolveProviders(env);
  for (const provider of providers) {
    if (provider === "stripe" && isEnabled(env.ENABLE_STRIPE_PAYMENTS, true)) {
      if (env.STRIPE_SECRET_KEY) {
        return createStripeCheckout(userId, priceId, priceInfo.points, env);
      }
    }
    if (provider === "creem" && isEnabled(env.ENABLE_CREEM_PAYMENTS, false)) {
      const url = buildExternalCheckoutUrl("creem", userId, priceInfo.points, priceId, env);
      if (url) return url;
    }
    if (provider === "dodo" && isEnabled(env.ENABLE_DODO_PAYMENTS, false)) {
      const url = buildExternalCheckoutUrl("dodo", userId, priceInfo.points, priceId, env);
      if (url) return url;
    }
  }

  throw new Error("No enabled payment provider is available.");
}

function resolveProviders(env: Env): string[] {
  const raw = (env.PAYMENT_PROVIDER_ORDER || "stripe,creem,dodo").toLowerCase();
  const list = raw.split(",").map((x) => x.trim()).filter(Boolean);
  return list.length ? list : ["stripe"];
}

function isEnabled(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue;
  return raw.toLowerCase() === "true";
}

function resolvePackLabel(priceId: string, env: Env): "50" | "100" | null {
  if (priceId === env.STRIPE_PRICE_BASIC || priceId === env.STRIPE_PRICE_PACK_100) return "50";
  if (priceId === env.STRIPE_PRICE_PRO) return "100";
  return null;
}

function buildExternalCheckoutUrl(
  provider: "creem" | "dodo",
  userId: string,
  points: string,
  priceId: string,
  env: Env
): string | null {
  const pack = resolvePackLabel(priceId, env);
  if (!pack) return null;
  const base =
    provider === "creem"
      ? (pack === "50" ? env.CREEM_CHECKOUT_URL_50 : env.CREEM_CHECKOUT_URL_100)
      : (pack === "50" ? env.DODO_CHECKOUT_URL_50 : env.DODO_CHECKOUT_URL_100);
  if (!base) return null;

  const url = new URL(base);
  url.searchParams.set("client_reference_id", userId);
  url.searchParams.set("user_id", userId);
  url.searchParams.set("points", points);
  url.searchParams.set("provider", provider);
  return url.toString();
}

async function createStripeCheckout(userId: string, priceId: string, points: string, env: Env): Promise<string> {
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${env.APP_ORIGIN}/pricing?success=true`,
      cancel_url: `${env.APP_ORIGIN}/pricing?canceled=true`,
      client_reference_id: userId,
      "metadata[points]": points,
      "metadata[user_id]": userId,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Stripe checkout failed: ${response.status} ${errText}`);
  }

  const session = (await response.json()) as { url?: string };
  if (!session.url) throw new Error("Missing Stripe checkout URL");
  return session.url;
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

interface StripeCheckoutSession {
  id: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
}

interface StripeCharge {
  id: string;
  amount: number;
  amount_refunded: number;
  metadata?: Record<string, string>;
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

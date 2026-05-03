import { JWTPayload, Env } from "./types";

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  let normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  return atob(normalized);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return toBase64Url(binary);
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const binary = fromBase64Url(base64url);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function textToUint8Array(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export async function signJWT(
  payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "jti">,
  env: Env
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const fullPayload: JWTPayload = {
    ...payload,
    jti,
    iat: now,
    exp: now + parseInt(env.JWT_EXPIRY_SECONDS),
    iss: env.JWT_ISSUER,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    textToUint8Array(env.JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, textToUint8Array(signatureInput));
  return `${signatureInput}.${arrayBufferToBase64Url(signature)}`;
}

export async function verifyJWT(token: string, env: Env): Promise<JWTPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    textToUint8Array(env.JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signatureBuffer = base64UrlToArrayBuffer(encodedSignature);
  const valid = await crypto.subtle.verify("HMAC", key, signatureBuffer, textToUint8Array(signatureInput));
  if (!valid) return null;

  try {
    const payload: JWTPayload = JSON.parse(fromBase64Url(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.iss !== env.JWT_ISSUER) return null;

    const revoked = await env.AUTH_KV.get(`revoke:${payload.jti}`);
    if (revoked) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function revokeJWT(jti: string, exp: number, env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(exp - now, 60);
  await env.AUTH_KV.put(`revoke:${jti}`, "1", { expirationTtl: ttl });
}

export function parseCookieToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/access_token=([^;]+)/);
  return match ? match[1] : null;
}

import { Env } from "./types";

export async function createUploadUrl(
  userId: string,
  fileName: string,
  contentType: string,
  size: number,
  env: Env
): Promise<{ uploadUrl: string; key: string; shareToken: string; expiresAt: number } | null> {
  const maxSize = parseInt(env.MAX_FILE_SIZE_BYTES);
  if (size > maxSize) return null;

  const key = `${userId}/${crypto.randomUUID()}/${fileName}`;
  const expiresAt = Math.floor(Date.now() / 1000) + parseInt(env.R2_FILE_TTL_SECONDS);
  const shareToken = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO r2_files (key, user_id, original_name, size_bytes, mime_type, share_token, share_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(key, userId, fileName, size, contentType, shareToken, expiresAt)
    .run();

  return {
    uploadUrl: `/api/r2/upload/${encodeURIComponent(key)}`,
    key,
    shareToken,
    expiresAt,
  };
}

export async function uploadFile(
  userId: string,
  key: string,
  body: ArrayBuffer,
  contentType: string,
  env: Env
): Promise<boolean> {
  if (!key.startsWith(`${userId}/`)) return false;

  await env.R2.put(key, body, {
    httpMetadata: { contentType: contentType || "application/octet-stream" },
  });

  return true;
}

export async function getSharedFile(
  shareToken: string,
  env: Env
): Promise<{ body: ReadableStream; contentType: string; fileName: string } | null> {
  const fileRecord = await env.DB.prepare(
    "SELECT key, share_expires_at, mime_type, original_name FROM r2_files WHERE share_token = ?"
  )
    .bind(shareToken)
    .first<{ key: string; share_expires_at: number; mime_type: string; original_name: string }>();

  if (!fileRecord) return null;

  const now = Math.floor(Date.now() / 1000);
  if (fileRecord.share_expires_at < now) return null;

  const object = await env.R2.get(fileRecord.key);
  if (!object) return null;

  return {
    body: object.body as ReadableStream,
    contentType: fileRecord.mime_type,
    fileName: fileRecord.original_name,
  };
}

export async function getFileForWorkflow(
  userId: string,
  key: string,
  env: Env
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!key.startsWith(`${userId}/`)) return null;

  const object = await env.R2.get(key);
  if (!object) return null;

  return {
    body: await object.arrayBuffer(),
    contentType: object.httpMetadata?.contentType || "application/octet-stream",
  };
}

export async function cleanExpiredR2Files(env: Env): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const expired = await env.DB.prepare(
    "SELECT key FROM r2_files WHERE share_expires_at < ? LIMIT 100"
  )
    .bind(now)
    .all<{ key: string }>();

  if (expired.results.length === 0) return 0;

  for (const file of expired.results) {
    await env.R2.delete(file.key);
    await env.DB.prepare("DELETE FROM r2_files WHERE key = ?")
      .bind(file.key)
      .run();
  }

  return expired.results.length;
}

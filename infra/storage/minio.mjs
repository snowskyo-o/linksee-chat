import { Client } from "minio";
import { env } from "../config/env.mjs";

export const minioClient = globalThis.__linkseeChatMinio || new Client({
  endPoint: env.minio.endPoint,
  port: env.minio.port,
  useSSL: env.minio.useSSL,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});

if (!globalThis.__linkseeChatMinio) {
  globalThis.__linkseeChatMinio = minioClient;
}

export function toPublicMinioUrl(url) {
  const publicOrigin = env.minio.publicOrigin;
  if (!publicOrigin) return url;

  const source = new URL(url);
  const target = new URL(publicOrigin);
  source.protocol = target.protocol;
  source.hostname = target.hostname;
  source.port = target.port;
  return source.toString();
}

export async function ensureStorageReady() {
  const buckets = [env.minio.bucketChatFiles, env.minio.bucketAvatars];
  for (const bucket of buckets) {
    const exists = await minioClient.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await minioClient.makeBucket(bucket, "us-east-1");
    }
  }
}

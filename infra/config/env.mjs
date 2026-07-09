export const env = {
  port: Number(process.env.PORT || "3010"),
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || "127.0.0.1",
    port: Number(process.env.MINIO_PORT || "9000"),
    useSSL: String(process.env.MINIO_USE_SSL || "false") === "true",
    publicOrigin: String(process.env.MINIO_PUBLIC_ORIGIN || "").trim(),
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    bucketChatFiles: process.env.MINIO_BUCKET_CHAT_FILES || "chat-files",
    bucketAvatars: process.env.MINIO_BUCKET_AVATARS || "chat-avatars",
  },
  session: {
    accessTtlSeconds: Number(process.env.SESSION_ACCESS_TTL_SECONDS || "1800"),
    refreshTtlSeconds: Number(process.env.SESSION_REFRESH_TTL_SECONDS || "604800"),
  },
};

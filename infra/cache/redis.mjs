import Redis from "ioredis";
import { env } from "../config/env.mjs";

export const redis = globalThis.__linkseeChatRedis || new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

if (!globalThis.__linkseeChatRedis) {
  globalThis.__linkseeChatRedis = redis;
}

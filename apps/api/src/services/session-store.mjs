import crypto from "node:crypto";
import { env } from "../../../../infra/config/env.mjs";
import { redis } from "../../../../infra/cache/redis.mjs";

function accessKey(token) {
  return `chat:session:access:${token}`;
}

function refreshKey(token) {
  return `chat:session:refresh:${token}`;
}

export async function issueSession(userId) {
  const accessToken = crypto.randomUUID();
  const refreshToken = crypto.randomUUID();

  await Promise.all([
    redis.set(accessKey(accessToken), userId, "EX", env.session.accessTtlSeconds),
    redis.set(refreshKey(refreshToken), userId, "EX", env.session.refreshTtlSeconds),
  ]);

  return { accessToken, refreshToken };
}

export async function findUserIdByAccessToken(token) {
  if (!token) return "";
  return (await redis.get(accessKey(token))) || "";
}

export async function findUserIdByRefreshToken(token) {
  if (!token) return "";
  return (await redis.get(refreshKey(token))) || "";
}

export async function revokeRefreshToken(token) {
  if (!token) return;
  await redis.del(refreshKey(token));
}

export async function revokeAccessToken(token) {
  if (!token) return;
  await redis.del(accessKey(token));
}

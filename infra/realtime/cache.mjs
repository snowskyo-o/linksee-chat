import { redis } from "../cache/redis.mjs";

const ROOM_TTL_SECONDS = 24 * 60 * 60;
const ACK_TTL_SECONDS = 24 * 60 * 60;
const ROOM_MAX_EVENTS = 200;

function roomKey(room) {
  return `chat:realtime:room:${room}`;
}

function ackKey(userId) {
  return `chat:realtime:ack:${userId}`;
}

export async function cacheRealtimeEvent(room, event) {
  const key = roomKey(room);
  await redis.multi()
    .rpush(key, JSON.stringify(event))
    .ltrim(key, -ROOM_MAX_EVENTS, -1)
    .expire(key, ROOM_TTL_SECONDS)
    .exec();
}

export async function loadReplayEvents(room, afterEventId = "") {
  const rows = await redis.lrange(roomKey(room), 0, -1);
  const events = rows.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  }).filter(Boolean);
  if (!afterEventId) return events;
  const index = events.findIndex((event) => event.id === afterEventId);
  return index >= 0 ? events.slice(index + 1) : events;
}

export async function ackRealtimeEvent(userId, eventId) {
  await redis.multi()
    .sadd(ackKey(userId), eventId)
    .expire(ackKey(userId), ACK_TTL_SECONDS)
    .exec();
}

export async function filterAckedEvents(userId, events) {
  if (!events.length) return [];
  const members = await redis.smembers(ackKey(userId));
  const acked = new Set(members);
  return events.filter((event) => !acked.has(event.id));
}

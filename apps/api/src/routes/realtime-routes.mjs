import { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { ackRealtimeEvent, filterAckedEvents, loadReplayEvents } from "../../../../infra/realtime/cache.mjs";

function parseRoom(rawValue, res) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "room 必填" });
    return "";
  }
  return rawValue.trim();
}

async function ensureRoomReadable(room, userId) {
  const conversationId = BigInt(room);
  const membership = await prisma.chatConversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  }).catch(() => null);
  return Boolean(membership);
}

export const realtimeRouter = Router();

realtimeRouter.post("/realtime/acks", async (req, res) => {
  const eventId = typeof req.body?.eventId === "string" ? req.body.eventId : "";
  const room = parseRoom(req.body?.roomKey, res);
  if (!eventId || !room) {
    if (!eventId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "eventId 必填" });
    }
    return;
  }
  if (!(await ensureRoomReadable(room, req.userId))) {
    return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "无权访问房间" });
  }

  await ackRealtimeEvent(req.userId, eventId);
  const messageId = typeof req.body?.messageId === "string" ? req.body.messageId : "";
  if (messageId) {
    await prisma.chatConversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId: BigInt(room),
          userId: req.userId,
        },
      },
      update: {
        lastMessageId: BigInt(messageId),
        lastReadAt: new Date(),
      },
      create: {
        conversationId: BigInt(room),
        userId: req.userId,
        lastMessageId: BigInt(messageId),
        lastReadAt: new Date(),
      },
    }).catch(() => {});
  }
  return res.json({ ok: true });
});

realtimeRouter.get("/realtime/replay", async (req, res) => {
  const room = parseRoom(req.query.room, res);
  if (!room) return;
  if (!(await ensureRoomReadable(room, req.userId))) {
    return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "无权访问房间" });
  }
  const afterEventId = typeof req.query.afterEventId === "string" ? req.query.afterEventId : "";
  const events = await loadReplayEvents(room, afterEventId);
  const filtered = await filterAckedEvents(req.userId, events);
  return res.json({ ok: true, data: filtered });
});

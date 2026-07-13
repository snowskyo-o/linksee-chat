import crypto from "node:crypto";
import { Server } from "socket.io";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { cacheRealtimeEvent } from "../../../../infra/realtime/cache.mjs";
import { sanitizeUser } from "../services/chat-store.mjs";
import { findUserIdByAccessToken } from "../services/session-store.mjs";

export function setupSocketGateway(server) {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: false,
    },
  });

  io.on("connection", async (socket) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token || "";
    const userId = await findUserIdByAccessToken(token);
    if (!userId) {
      socket.emit("realtime:event", { topic: "auth.error", payload: { message: "Unauthenticated" } });
      socket.disconnect(true);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    const memberships = await prisma.chatConversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    memberships.forEach((row) => socket.join(row.conversationId.toString()));
    socket.emit("realtime:event", {
      topic: "socket.ready",
      payload: { user: sanitizeUser(user) },
    });

    socket.on("conversation.join", async (conversationId) => {
      const numericId = BigInt(String(conversationId || 0));
      const membership = await prisma.chatConversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: numericId,
            userId,
          },
        },
      }).catch(() => null);
      if (!membership) return;
      socket.join(String(conversationId));
    });
  });

  return {
    emitConversationEvent(conversationId, topic, payload) {
      const event = {
        id: crypto.randomUUID(),
        topic,
        payload: {
          conversationId: String(conversationId),
          ...payload,
        },
      };
      cacheRealtimeEvent(String(conversationId), event).catch(() => {});
      io.to(String(conversationId)).emit("realtime:event", event);
    },
    async emitUserProfileEvent(userId, topic, payload) {
      const memberships = await prisma.chatConversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
      });
      const rooms = [...new Set(memberships.map((row) => row.conversationId.toString()))];
      rooms.forEach((room) => {
        const event = {
          id: crypto.randomUUID(),
          topic,
          payload: {
            conversationId: room,
            userId,
            ...payload,
          },
        };
        cacheRealtimeEvent(room, event).catch(() => {});
        io.to(room).emit("realtime:event", event);
      });
    },
  };
}

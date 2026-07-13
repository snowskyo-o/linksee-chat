import { prisma } from "../../../../infra/db/prisma.mjs";

export async function loadConversationMeta(userId, conversation) {
  const [reads, pin, lastMessage] = await Promise.all([
    prisma.chatConversationRead.findUnique({
      where: { conversationId_userId: { conversationId: conversation.id, userId } },
    }),
    prisma.chatConversationPin.findUnique({
      where: { conversationId_userId: { conversationId: conversation.id, userId } },
    }),
    prisma.chatMessage.findFirst({
      where: { conversationId: conversation.id, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { sender: { include: { profile: true } }, filesMeta: true },
    }),
  ]);
  return { reads, pin, lastMessage };
}

export async function loadUnreadState(userId, conversationId, lastMessageId) {
  const where = {
    conversationId,
    deletedAt: null,
    ...(lastMessageId ? { id: { gt: lastMessageId } } : {}),
  };
  const [unreadCount, unreadMessages] = await Promise.all([
    prisma.chatMessage.count({ where }),
    prisma.chatMessage.findMany({ where, select: { mentions: true } }),
  ]);
  const unreadMentionCount = unreadMessages.filter((message) => (
    Array.isArray(message.mentions) && message.mentions.includes(userId)
  )).length;
  return { unreadCount, unreadMentionCount };
}

import crypto from "node:crypto";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { sanitizeUser } from "./chat-user-presenter.mjs";
import { buildDirectConversationWhere, buildFriendshipWhere, collectContactIds } from "./chat-store-helpers.mjs";
import { decorateUsersWithFriendAliases } from "./friend-store.mjs";

export function nextEventId() {
  return crypto.randomUUID();
}

export function nextTraceId() {
  return crypto.randomUUID();
}

export async function findUserById(userId) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
}

export async function findContacts(userId) {
  const [friendships, directConversations] = await Promise.all([
    prisma.chatFriendship.findMany({
      where: buildFriendshipWhere(userId),
    }),
    prisma.chatConversation.findMany({
      where: buildDirectConversationWhere(userId),
      include: {
        members: {
          include: {
            user: { include: { profile: true } },
          },
        },
      },
    }),
  ]);
  const contactIds = collectContactIds(friendships, directConversations, userId);
  if (!contactIds.size) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { in: Array.from(contactIds) },
      isActive: true,
    },
    orderBy: { id: "asc" },
    include: { profile: true },
  });
  return decorateUsersWithFriendAliases(userId, users.map(sanitizeUser));
}

export async function resolveConversationById(conversationId) {
  if (!conversationId) return null;
  return prisma.chatConversation.findUnique({
    where: { id: BigInt(conversationId) },
    include: {
      members: {
        include: {
          user: { include: { profile: true } },
        },
      },
    },
  }).catch(() => null);
}

export async function getConversationParticipants(conversationId) {
  const members = await prisma.chatConversationMember.findMany({
    where: { conversationId: BigInt(conversationId) },
    orderBy: { joinedAt: "asc" },
    include: {
      user: { include: { profile: true } },
    },
  });
  return members.map((row) => sanitizeUser(row.user));
}

export function buildConversationTitle(conversation, currentUserId) {
  if (conversation.title) return conversation.title;
  if (conversation.kind === "direct") {
    const other = conversation.members
      ?.map((member) => member.user)
      .find((user) => user.id !== currentUserId);
    return other?.profile?.realName || other?.id || "私聊";
  }
  return conversation.roomKey || "未命名会话";
}

export function buildMessageType(files, content) {
  if (files && typeof files === "object" && !Array.isArray(files)) {
    if (files.type === "announcement") return "announcement";
  }
  if (Array.isArray(files) && files.length > 0) return "file";
  if (content && String(content).trim()) return "text";
  return "text";
}

export { publicAvatarUrl, sanitizeUser } from "./chat-user-presenter.mjs";

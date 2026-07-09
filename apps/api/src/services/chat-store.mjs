import crypto from "node:crypto";
import { prisma } from "../../../../infra/db/prisma.mjs";

export function publicAvatarUrl(user) {
  if (!user?.profile?.avatarUrl) return "";
  if (String(user.profile.avatarUrl).startsWith("minio:")) {
    return `/api/v1/users/${encodeURIComponent(user.id)}/avatar`;
  }
  return user.profile.avatarUrl;
}

export function nextEventId() {
  return crypto.randomUUID();
}

export function nextTraceId() {
  return crypto.randomUUID();
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    profile: {
      realName: user.profile?.realName || user.id,
      bio: user.profile?.bio || "",
      avatarUrl: publicAvatarUrl(user),
    },
  };
}

export async function findUserById(userId) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
}

export async function findContacts(userId) {
  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      isActive: true,
    },
    orderBy: { id: "asc" },
    include: { profile: true },
  });
  return users.map(sanitizeUser);
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

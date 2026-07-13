import { prisma } from "../../../../infra/db/prisma.mjs";
import { findUserById } from "./chat-store.mjs";

const conversationMembersInclude = {
  members: { include: { user: { include: { profile: true } } } },
};

function parseParticipantIds(userId, body) {
  const participantIds = Array.isArray(body?.participantIds)
    ? body.participantIds.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean)
    : [];
  return Array.from(new Set([userId, ...participantIds]));
}

async function createDirectConversation(userId, body, res) {
  const peerId = typeof body?.peerId === "string" ? body.peerId.trim() : "";
  if (!peerId || peerId === userId) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "peerId 无效" });
    return null;
  }
  const peer = await findUserById(peerId);
  if (!peer) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "联系人不存在" });
    return null;
  }

  const directKey = [userId, peerId].sort().join(":");
  const existing = await prisma.chatConversation.findUnique({
    where: { directKey },
    include: conversationMembersInclude,
  });
  if (existing) return { conversation: existing, statusCode: 200 };

  const conversation = await prisma.chatConversation.create({
    data: {
      kind: "direct",
      scopeId: directKey,
      roomKey: `dm:${directKey}`,
      directKey,
      members: { create: [{ userId }, { userId: peerId }] },
    },
    include: conversationMembersInclude,
  });

  return { conversation, statusCode: 201 };
}

async function createGroupConversation(userId, body, res) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const mergedParticipants = parseParticipantIds(userId, body);

  if (mergedParticipants.length < 2) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "群聊至少需要 2 个成员" });
    return null;
  }
  if (!title) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "title 必填" });
    return null;
  }
  if (title.length > 60) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "title 不能超过 60 个字符" });
    return null;
  }

  const foundUsers = await prisma.user.findMany({
    where: { id: { in: mergedParticipants } },
    select: { id: true },
  });
  const foundIds = new Set(foundUsers.map((user) => user.id));
  const missingIds = mergedParticipants.filter((memberUserId) => !foundIds.has(memberUserId));
  if (missingIds.length > 0) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `用户不存在: ${missingIds.join(", ")}` });
    return null;
  }

  const scopeSeed = Date.now();
  const conversation = await prisma.chatConversation.create({
    data: {
      kind: "group",
      title,
      scopeId: `group:${scopeSeed}`,
      roomKey: `group:${scopeSeed}:${Math.random().toString(36).slice(2, 8)}`,
      createdBy: userId,
      members: {
        create: mergedParticipants.map((memberUserId) => ({ userId: memberUserId })),
      },
    },
    include: conversationMembersInclude,
  });

  return { conversation, statusCode: 201 };
}

export async function createConversationForRequest(userId, body, res) {
  const kind = body?.kind === "direct" ? "direct" : "group";
  return kind === "direct"
    ? createDirectConversation(userId, body, res)
    : createGroupConversation(userId, body, res);
}

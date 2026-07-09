import { prisma } from "../../../../infra/db/prisma.mjs";
import {
  buildConversationTitle,
  buildMessageType,
  findUserById,
  getConversationParticipants,
  publicAvatarUrl,
  resolveConversationById,
  sanitizeUser,
} from "./chat-store.mjs";

export async function parseMentions(conversationId, content) {
  const participants = await getConversationParticipants(conversationId);
  const names = new Map(participants.map((user) => [String(user.profile.realName || ""), user.id]));
  const found = new Set();

  (String(content || "").match(/@([A-Za-z0-9_\-\u4e00-\u9fa5]+)/g) || []).forEach((token) => {
    const raw = token.slice(1);
    if (names.has(raw)) found.add(names.get(raw));
  });

  return Array.from(found);
}

export function validateContent(content, res) {
  if (!content) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "content 必填" });
    return false;
  }
  if (content.length > 5000) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "content 不能超过 5000 个字符" });
    return false;
  }
  return true;
}

export async function requireConversation(req, res) {
  const conversation = await resolveConversationById(req.params.conversationId);
  if (!conversation) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "会话不存在" });
    return null;
  }

  const member = conversation.members.find((item) => item.userId === req.userId);
  if (!member) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "会话不存在" });
    return null;
  }

  return { conversation };
}

export async function createConversationForRequest(userId, body, res) {
  const kind = body?.kind === "direct" ? "direct" : "group";

  if (kind === "direct") {
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
      include: {
        members: {
          include: { user: { include: { profile: true } } },
        },
      },
    });
    if (existing) {
      return { conversation: existing, statusCode: 200 };
    }

    const conversation = await prisma.chatConversation.create({
      data: {
        kind: "direct",
        scopeId: directKey,
        roomKey: `dm:${directKey}`,
        directKey,
        members: {
          create: [{ userId }, { userId: peerId }],
        },
      },
      include: {
        members: {
          include: { user: { include: { profile: true } } },
        },
      },
    });

    return { conversation, statusCode: 201 };
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const participantIds = Array.isArray(body?.participantIds)
    ? body.participantIds.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean)
    : [];
  const mergedParticipants = Array.from(new Set([userId, ...participantIds]));

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

  const conversation = await prisma.chatConversation.create({
    data: {
      kind: "group",
      title,
      scopeId: `group:${Date.now()}`,
      roomKey: `group:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      createdBy: userId,
      members: {
        create: mergedParticipants.map((memberUserId) => ({ userId: memberUserId })),
      },
    },
    include: {
      members: {
        include: { user: { include: { profile: true } } },
      },
    },
  });

  return { conversation, statusCode: 201 };
}

export async function buildConversationResponse(userId, conversation) {
  const [reads, pin, lastMessage] = await Promise.all([
    prisma.chatConversationRead.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId,
        },
      },
    }),
    prisma.chatConversationPin.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId,
        },
      },
    }),
    prisma.chatMessage.findFirst({
      where: { conversationId: conversation.id, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        sender: { include: { profile: true } },
        filesMeta: true,
      },
    }),
  ]);

  const unreadCount = await prisma.chatMessage.count({
    where: {
      conversationId: conversation.id,
      deletedAt: null,
      ...(reads?.lastMessageId ? { id: { gt: reads.lastMessageId } } : {}),
    },
  });
  const unreadMessages = await prisma.chatMessage.findMany({
    where: {
      conversationId: conversation.id,
      deletedAt: null,
      ...(reads?.lastMessageId ? { id: { gt: reads.lastMessageId } } : {}),
    },
    select: { mentions: true },
  });
  const unreadMentionCount = unreadMessages.filter((message) => (
    Array.isArray(message.mentions) && message.mentions.includes(userId)
  )).length;

  return {
    id: conversation.id.toString(),
    title: buildConversationTitle(conversation, userId),
    roomKey: conversation.roomKey,
    kind: conversation.kind,
    updatedAt: conversation.updatedAt.toISOString(),
    pinnedAt: pin?.pinnedAt?.toISOString() || null,
    scopeType: conversation.kind,
    scopeId: conversation.scopeId,
    unreadCount,
    unreadMentionCount,
    participants: conversation.members.map((member) => sanitizeUser(member.user)),
    participantIds: conversation.members.map((member) => member.userId),
    lastReadAt: reads?.lastReadAt?.toISOString() || null,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id.toString(),
          conversationId: lastMessage.conversationId.toString(),
          senderId: lastMessage.senderId,
          sender: {
            id: lastMessage.sender.id,
            role: lastMessage.sender.role,
            profile: {
              realName: lastMessage.sender.profile?.realName || lastMessage.sender.id,
              bio: lastMessage.sender.profile?.bio || "",
              avatarUrl: publicAvatarUrl(lastMessage.sender),
            },
          },
          content: lastMessage.content,
          type: buildMessageType(lastMessage.files, lastMessage.content),
          files: Array.isArray(lastMessage.files) ? lastMessage.files : null,
          deletedAt: lastMessage.deletedAt?.toISOString?.() || null,
        }
      : null,
  };
}

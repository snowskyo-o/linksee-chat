import crypto from "node:crypto";
import { prisma } from "../infra/db/prisma.mjs";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

async function upsertUser({ id, password, role, realName, bio, avatarUrl = "" }) {
  const passwordHash = hashPassword(password);
  await prisma.user.upsert({
    where: { id },
    update: {
      passwordHash,
      role,
      isActive: true,
      profile: {
        upsert: {
          update: { realName, bio, avatarUrl },
          create: { realName, bio, avatarUrl },
        },
      },
    },
    create: {
      id,
      passwordHash,
      role,
      profile: {
        create: { realName, bio, avatarUrl },
      },
    },
  });
}

async function ensureDirectConversation(userA, userB) {
  const directKey = [userA, userB].sort().join(":");
  const existing = await prisma.chatConversation.findUnique({
    where: { directKey },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.chatConversation.create({
    data: {
      kind: "direct",
      scopeId: directKey,
      roomKey: `dm:${directKey}`,
      directKey,
      members: {
        create: [
          { userId: userA },
          { userId: userB },
        ],
      },
    },
    select: { id: true },
  });
  return created.id;
}

async function ensureGroupConversation(title, createdBy, participantIds) {
  const scopeId = `group:${title}`;
  const existing = await prisma.chatConversation.findFirst({
    where: { kind: "group", title, createdBy },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.chatConversation.create({
    data: {
      kind: "group",
      title,
      scopeId,
      roomKey: `group:${crypto.randomUUID()}`,
      createdBy,
      members: {
        create: participantIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });
  return created.id;
}

async function ensureMessage({ conversationId, senderId, content, mentions = [], replyToId = null, files = null }) {
  const eventId = crypto.randomUUID();
  await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId,
      content,
      files,
      mentions,
      replyToId,
      eventId,
      traceId: crypto.randomUUID(),
    },
  }).catch(() => {});
}

async function main() {
  await upsertUser({
    id: "1000000001",
    password: "Chat1234",
    role: "admin",
    realName: "Alice",
    bio: "Let us ship.",
  });
  await upsertUser({
    id: "1000000002",
    password: "Chat1234",
    role: "member",
    realName: "Bob",
    bio: "Realtime first.",
  });
  await upsertUser({
    id: "1000000003",
    password: "Chat1234",
    role: "member",
    realName: "Cindy",
    bio: "Mentions and search.",
  });

  const generalId = await ensureGroupConversation("全体聊天", "1000000001", [
    "1000000001",
    "1000000002",
    "1000000003",
  ]);
  const productId = await ensureGroupConversation("产品讨论", "1000000001", [
    "1000000001",
    "1000000002",
  ]);
  const directId = await ensureDirectConversation("1000000001", "1000000003");

  const existingCount = await prisma.chatMessage.count();
  if (existingCount === 0) {
    await ensureMessage({
      conversationId: generalId,
      senderId: "1000000001",
      content: "欢迎来到 Linksee Chat。",
      files: { type: "announcement" },
    });
    const replyBase = await prisma.chatMessage.findFirst({
      where: { conversationId: generalId },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    await ensureMessage({
      conversationId: generalId,
      senderId: "1000000002",
      content: "@Alice 我把最小聊天版界面整理好了。",
      mentions: ["1000000001"],
      replyToId: replyBase?.id ?? null,
    });
    await ensureMessage({
      conversationId: productId,
      senderId: "1000000001",
      content: "今天先把后端接口补齐。",
    });
    await ensureMessage({
      conversationId: directId,
      senderId: "1000000003",
      content: "@Alice 晚点把桌面版 UI 风格也收一下。",
      mentions: ["1000000001"],
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[seed] failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });

import { clearConversationMemberState } from "./chat-route-helpers.mjs";
import {
  buildConversationResponse,
  forbidden,
  notFound,
  prisma,
  requireConversation,
  resolveConversationById,
  validationFailed,
} from "./chat-conversation-route-shared.mjs";

function parseParticipantIds(input) {
  return Array.isArray(input)
    ? input.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean)
    : [];
}

function ensureGroupConversation(ctx, res) {
  if (ctx.conversation.kind === "group") return true;
  validationFailed(res, "当前会话不是群聊");
  return false;
}

export function registerChatGroupRoutes(router, emitConversationEvent) {
  router.patch("/conversations/:conversationId/group", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx || !ensureGroupConversation(ctx, res)) return;
    if (ctx.conversation.createdBy !== req.userId) return forbidden(res, "只有群主可以修改群名称");
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) return validationFailed(res, "title 必填");
    if (title.length > 60) return validationFailed(res, "title 不能超过 60 个字符");
    await prisma.chatConversation.update({ where: { id: ctx.conversation.id }, data: { title } });
    const updatedConversation = await resolveConversationById(req.params.conversationId);
    emitConversationEvent(ctx.conversation.id, "conversation.updated", { conversationId: req.params.conversationId });
    return res.json({ ok: true, data: await buildConversationResponse(req.userId, updatedConversation) });
  });

  router.post("/conversations/:conversationId/members", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx || !ensureGroupConversation(ctx, res)) return;
    const participantIds = parseParticipantIds(req.body?.participantIds);
    const existingIds = new Set(ctx.conversation.members.map((member) => member.userId));
    const nextParticipantIds = Array.from(new Set(participantIds)).filter((userId) => !existingIds.has(userId));
    if (!nextParticipantIds.length) return validationFailed(res, "没有可新增的群成员");
    const users = await prisma.user.findMany({
      where: { id: { in: nextParticipantIds }, isActive: true },
      select: { id: true },
    });
    const foundIds = new Set(users.map((user) => user.id));
    const missingIds = nextParticipantIds.filter((userId) => !foundIds.has(userId));
    if (missingIds.length) return validationFailed(res, `用户不存在: ${missingIds.join(", ")}`);
    await prisma.chatConversationMember.createMany({
      data: nextParticipantIds.map((userId) => ({ conversationId: ctx.conversation.id, userId })),
      skipDuplicates: true,
    });
    await prisma.chatConversation.update({ where: { id: ctx.conversation.id }, data: { updatedAt: new Date() } });
    const updatedConversation = await resolveConversationById(req.params.conversationId);
    emitConversationEvent(ctx.conversation.id, "conversation.members.updated", { conversationId: req.params.conversationId });
    return res.json({ ok: true, data: await buildConversationResponse(req.userId, updatedConversation) });
  });

  router.post("/conversations/:conversationId/leave", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx || !ensureGroupConversation(ctx, res)) return;
    const remainingMembers = ctx.conversation.members.filter((member) => member.userId !== req.userId);
    if (!remainingMembers.length) {
      await prisma.chatConversation.delete({ where: { id: ctx.conversation.id } });
      return res.json({ ok: true, data: { conversationId: req.params.conversationId, removed: true } });
    }
    const nextOwnerId = ctx.conversation.createdBy === req.userId ? remainingMembers[0]?.userId || "" : ctx.conversation.createdBy;
    await clearConversationMemberState(ctx.conversation.id, req.userId);
    await prisma.chatConversation.update({
      where: { id: ctx.conversation.id },
      data: { createdBy: nextOwnerId || null, updatedAt: new Date() },
    });
    emitConversationEvent(ctx.conversation.id, "conversation.members.updated", { conversationId: req.params.conversationId });
    return res.json({ ok: true, data: { conversationId: req.params.conversationId, removed: true, nextOwnerId } });
  });

  router.delete("/conversations/:conversationId/members/:memberUserId", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx || !ensureGroupConversation(ctx, res)) return;
    if (ctx.conversation.createdBy !== req.userId) return forbidden(res, "只有群主可以移除成员");
    const memberUserId = String(req.params.memberUserId || "").trim();
    if (!memberUserId || memberUserId === req.userId) return validationFailed(res, "不能移除群主本人");
    const targetMember = ctx.conversation.members.find((member) => member.userId === memberUserId);
    if (!targetMember) return notFound(res, "群成员不存在");
    await clearConversationMemberState(ctx.conversation.id, memberUserId);
    await prisma.chatConversation.update({ where: { id: ctx.conversation.id }, data: { updatedAt: new Date() } });
    const updatedConversation = await resolveConversationById(req.params.conversationId);
    emitConversationEvent(ctx.conversation.id, "conversation.members.updated", { conversationId: req.params.conversationId });
    return res.json({ ok: true, data: await buildConversationResponse(req.userId, updatedConversation) });
  });
}

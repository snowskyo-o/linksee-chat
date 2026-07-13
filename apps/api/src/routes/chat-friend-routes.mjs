import { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { findContacts, sanitizeUser } from "../services/chat-store.mjs";
import {
  ensureFriendship,
  findFriendship,
  listFriendDiscovery,
  listFriendRequestsForUser,
  removeFriendship,
  updateFriendAlias,
} from "../services/friend-store.mjs";

export function createChatFriendRouter() {
  const router = Router();

  router.get("/contacts", async (req, res) => {
    const contacts = await findContacts(req.userId);
    return res.json({ ok: true, data: contacts });
  });

  router.get("/friends/discovery", async (req, res) => {
    const keyword = typeof req.query.q === "string" ? req.query.q : "";
    const data = await listFriendDiscovery(req.userId, keyword);
    return res.json({ ok: true, data });
  });

  router.get("/friends/requests", async (req, res) => {
    const data = await listFriendRequestsForUser(req.userId);
    return res.json({ ok: true, data });
  });

  router.post("/friends/requests", async (req, res) => {
    const receiverId = typeof req.body?.receiverId === "string" ? req.body.receiverId.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 200) : "";
    if (!receiverId || receiverId === req.userId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "receiverId 无效" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: receiverId },
      include: { profile: true },
    });
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "用户不存在" });
    }

    const existingFriendship = await findFriendship(req.userId, receiverId);
    if (existingFriendship) {
      return res.status(409).json({ ok: false, code: "ALREADY_FRIEND", message: "已经是好友" });
    }

    const upserted = await prisma.chatFriendRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId: req.userId,
          receiverId,
        },
      },
      update: {
        status: "pending",
        message,
        processedAt: null,
      },
      create: {
        senderId: req.userId,
        receiverId,
        message,
      },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    });

    return res.status(201).json({
      ok: true,
      data: {
        id: upserted.id.toString(),
        status: upserted.status,
        senderId: upserted.senderId,
        receiverId: upserted.receiverId,
        message: upserted.message || "",
        sender: sanitizeUser(upserted.sender),
        receiver: sanitizeUser(upserted.receiver),
        updatedAt: upserted.updatedAt.toISOString(),
      },
    });
  });

  router.patch("/friends/requests/:requestId", async (req, res) => {
    const action = typeof req.body?.action === "string" ? req.body.action.trim() : "";
    if (!["accept", "reject", "cancel"].includes(action)) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "action 无效" });
    }

    const requestRow = await prisma.chatFriendRequest.findUnique({
      where: { id: BigInt(req.params.requestId) },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    }).catch(() => null);

    if (!requestRow) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "申请不存在" });
    }
    if (requestRow.status !== "pending") {
      return res.status(409).json({ ok: false, code: "REQUEST_FINISHED", message: "该申请已处理" });
    }

    if (action === "cancel") {
      if (requestRow.senderId !== req.userId) {
        return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能取消自己发出的申请" });
      }
    } else if (requestRow.receiverId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能处理发给自己的申请" });
    }

    const nextStatus = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "canceled";
    const updated = await prisma.chatFriendRequest.update({
      where: { id: requestRow.id },
      data: {
        status: nextStatus,
        processedAt: new Date(),
      },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    });

    if (action === "accept") {
      await ensureFriendship(updated.senderId, updated.receiverId);
    }

    return res.json({
      ok: true,
      data: {
        id: updated.id.toString(),
        status: updated.status,
        senderId: updated.senderId,
        receiverId: updated.receiverId,
        message: updated.message || "",
        sender: sanitizeUser(updated.sender),
        receiver: sanitizeUser(updated.receiver),
        updatedAt: updated.updatedAt.toISOString(),
        processedAt: updated.processedAt?.toISOString() || null,
      },
    });
  });

  router.patch("/friends/:friendUserId/alias", async (req, res) => {
    const friendUserId = typeof req.params.friendUserId === "string" ? req.params.friendUserId.trim() : "";
    const alias = typeof req.body?.alias === "string" ? req.body.alias.trim() : "";
    if (!friendUserId || friendUserId === req.userId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "friendUserId 无效" });
    }
    if (alias.length > 40) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "备注不能超过 40 个字符" });
    }

    const updated = await updateFriendAlias(req.userId, friendUserId, alias);
    if (!updated) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "好友关系不存在" });
    }

    return res.json({
      ok: true,
      data: {
        friendUserId,
        alias,
      },
    });
  });

  router.delete("/friends/:friendUserId", async (req, res) => {
    const friendUserId = typeof req.params.friendUserId === "string" ? req.params.friendUserId.trim() : "";
    if (!friendUserId || friendUserId === req.userId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "friendUserId 无效" });
    }

    const removed = await removeFriendship(req.userId, friendUserId);
    if (!removed) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "好友关系不存在" });
    }

    return res.json({
      ok: true,
      data: { friendUserId },
    });
  });

  return router;
}

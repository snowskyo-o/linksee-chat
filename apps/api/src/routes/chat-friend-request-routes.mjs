import { prisma } from "../../../../infra/db/prisma.mjs";
import { ensureFriendship } from "../services/friend-store.mjs";
import {
  badRequest,
  ensureRequestCreationAllowed,
  findEditableFriendRequest,
  mapFriendRequestPayload,
} from "./chat-friend-route-shared.mjs";

function resolveRequestAction(action) {
  if (action === "accept") return "accepted";
  if (action === "reject") return "rejected";
  if (action === "cancel") return "canceled";
  return "";
}

export function registerChatFriendRequestRoutes(router) {
  router.post("/friends/requests", async (req, res) => {
    const receiverId = typeof req.body?.receiverId === "string" ? req.body.receiverId.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 200) : "";
    const guard = await ensureRequestCreationAllowed(req.userId, receiverId);
    if (guard.error) {
      if (guard.status === 400) return badRequest(res, guard.error);
      return res.status(guard.status).json({ ok: false, code: guard.code || "NOT_FOUND", message: guard.error });
    }

    const upserted = await prisma.chatFriendRequest.upsert({
      where: { senderId_receiverId: { senderId: req.userId, receiverId } },
      update: { status: "pending", message, processedAt: null },
      create: { senderId: req.userId, receiverId, message },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    });

    return res.status(201).json({ ok: true, data: mapFriendRequestPayload(upserted) });
  });

  router.patch("/friends/requests/:requestId", async (req, res) => {
    const action = typeof req.body?.action === "string" ? req.body.action.trim() : "";
    const nextStatus = resolveRequestAction(action);
    if (!nextStatus) return badRequest(res, "action 无效");

    const requestRow = await findEditableFriendRequest(req.params.requestId);
    if (!requestRow) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "申请不存在" });
    }
    if (requestRow.status !== "pending") {
      return res.status(409).json({ ok: false, code: "REQUEST_FINISHED", message: "该申请已处理" });
    }
    if (action === "cancel" && requestRow.senderId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能取消自己发出的申请" });
    }
    if (action !== "cancel" && requestRow.receiverId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能处理发给自己的申请" });
    }

    const updated = await prisma.chatFriendRequest.update({
      where: { id: requestRow.id },
      data: { status: nextStatus, processedAt: new Date() },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    });

    if (action === "accept") await ensureFriendship(updated.senderId, updated.receiverId);
    return res.json({ ok: true, data: mapFriendRequestPayload(updated) });
  });
}

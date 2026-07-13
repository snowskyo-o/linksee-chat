import { prisma } from "../../../../infra/db/prisma.mjs";
import { sanitizeUser } from "../services/chat-store.mjs";
import { findFriendship } from "../services/friend-store.mjs";

export function badRequest(res, message) {
  return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message });
}

export function mapFriendRequestPayload(row) {
  return {
    id: row.id.toString(),
    status: row.status,
    senderId: row.senderId,
    receiverId: row.receiverId,
    message: row.message || "",
    sender: sanitizeUser(row.sender),
    receiver: sanitizeUser(row.receiver),
    updatedAt: row.updatedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() || null,
  };
}

export async function findRequestTargetUser(receiverId) {
  return prisma.user.findUnique({
    where: { id: receiverId },
    include: { profile: true },
  });
}

export async function findEditableFriendRequest(requestId) {
  return prisma.chatFriendRequest.findUnique({
    where: { id: BigInt(requestId) },
    include: {
      sender: { include: { profile: true } },
      receiver: { include: { profile: true } },
    },
  }).catch(() => null);
}

export async function ensureRequestCreationAllowed(currentUserId, receiverId) {
  if (!receiverId || receiverId === currentUserId) return { error: "receiverId 无效", status: 400 };
  const targetUser = await findRequestTargetUser(receiverId);
  if (!targetUser || !targetUser.isActive) return { error: "用户不存在", status: 404 };
  const existingFriendship = await findFriendship(currentUserId, receiverId);
  if (existingFriendship) return { error: "已经是好友", code: "ALREADY_FRIEND", status: 409 };
  return { targetUser };
}

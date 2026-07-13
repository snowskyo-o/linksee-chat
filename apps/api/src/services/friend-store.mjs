import { prisma } from "../../../../infra/db/prisma.mjs";
import { sanitizeUser } from "./chat-store.mjs";

function orderedFriendPair(userIdA, userIdB) {
  return [String(userIdA || ""), String(userIdB || "")].sort();
}

function mapFriendRequest(row, currentUserId) {
  if (!row) return null;
  const isIncoming = row.receiverId === currentUserId;
  return {
    id: row.id.toString(),
    senderId: row.senderId,
    receiverId: row.receiverId,
    status: row.status,
    message: row.message || "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() || null,
    direction: isIncoming ? "incoming" : "outgoing",
    sender: sanitizeUser(row.sender),
    receiver: sanitizeUser(row.receiver),
  };
}

export async function findFriendship(userIdA, userIdB) {
  const [userLowId, userHighId] = orderedFriendPair(userIdA, userIdB);
  if (!userLowId || !userHighId || userLowId === userHighId) return null;
  return prisma.chatFriendship.findUnique({
    where: {
      userLowId_userHighId: {
        userLowId,
        userHighId,
      },
    },
  });
}

export async function listFriendRequestsForUser(userId) {
  const rows = await prisma.chatFriendRequest.findMany({
    where: {
      OR: [
        { senderId: userId },
        { receiverId: userId },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    include: {
      sender: { include: { profile: true } },
      receiver: { include: { profile: true } },
    },
  });

  return rows.map((row) => mapFriendRequest(row, userId)).filter(Boolean);
}

export async function listFriendDiscovery(userId, keyword = "") {
  const search = String(keyword || "").trim().toLowerCase();
  const [users, requests, friendships] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { not: userId },
        isActive: true,
      },
      orderBy: { id: "asc" },
      include: { profile: true },
    }),
    prisma.chatFriendRequest.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    }),
    prisma.chatFriendship.findMany({
      where: {
        OR: [
          { userLowId: userId },
          { userHighId: userId },
        ],
      },
    }),
  ]);

  const requestMap = new Map();
  requests.forEach((row) => {
    const peerId = row.senderId === userId ? row.receiverId : row.senderId;
    if (!requestMap.has(peerId)) requestMap.set(peerId, row);
  });

  const friendshipSet = new Set(friendships.map((row) => (
    row.userLowId === userId ? row.userHighId : row.userLowId
  )));

  return users
    .filter((user) => {
      if (!search) return true;
      return [user.id, user.profile?.realName, user.profile?.bio]
        .some((value) => String(value || "").toLowerCase().includes(search));
    })
    .map((user) => {
      const request = requestMap.get(user.id) || null;
      const isFriend = friendshipSet.has(user.id);
      let relation = "none";
      if (isFriend) {
        relation = "friend";
      } else if (request?.status === "pending") {
        relation = request.senderId === userId ? "outgoing_pending" : "incoming_pending";
      } else if (request?.status === "accepted") {
        relation = "friend";
      } else if (request?.status === "rejected") {
        relation = "rejected";
      } else if (request?.status === "canceled") {
        relation = "canceled";
      }

      return {
        user: sanitizeUser(user),
        relation,
        request: request
          ? {
              id: request.id.toString(),
              status: request.status,
              senderId: request.senderId,
              receiverId: request.receiverId,
              message: request.message || "",
              updatedAt: request.updatedAt.toISOString(),
            }
          : null,
      };
    });
}

export async function ensureFriendship(userIdA, userIdB) {
  const [userLowId, userHighId] = orderedFriendPair(userIdA, userIdB);
  if (!userLowId || !userHighId || userLowId === userHighId) return null;
  return prisma.chatFriendship.upsert({
    where: {
      userLowId_userHighId: {
        userLowId,
        userHighId,
      },
    },
    update: {},
    create: {
      userLowId,
      userHighId,
    },
  });
}

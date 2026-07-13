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

function extractFriendAlias(friendship, currentUserId) {
  if (!friendship) return "";
  return friendship.userLowId === currentUserId
    ? String(friendship.lowAlias || "")
    : String(friendship.highAlias || "");
}

function decorateSanitizedUser(user, friendAlias = "") {
  const alias = String(friendAlias || "").trim();
  const originalRealName = user?.profile?.realName || user?.id || "";
  if (!user) return null;
  return {
    ...user,
    friendAlias: alias,
    profile: {
      ...(user.profile || {}),
      realName: alias || originalRealName,
      originalRealName,
    },
  };
}

export async function buildFriendAliasMap(userId, peerIds = []) {
  const rows = await prisma.chatFriendship.findMany({
    where: {
      OR: [
        { userLowId: userId, ...(peerIds.length ? { userHighId: { in: peerIds } } : {}) },
        { userHighId: userId, ...(peerIds.length ? { userLowId: { in: peerIds } } : {}) },
      ],
    },
  });

  return new Map(rows.map((row) => ([
    row.userLowId === userId ? row.userHighId : row.userLowId,
    extractFriendAlias(row, userId),
  ])));
}

export async function decorateUsersWithFriendAliases(userId, users = []) {
  const peerIds = users
    .map((user) => String(user?.id || "").trim())
    .filter(Boolean)
    .filter((peerId) => peerId !== userId);

  if (!peerIds.length) return users.map((user) => decorateSanitizedUser(user));
  const aliasMap = await buildFriendAliasMap(userId, peerIds);
  return users.map((user) => decorateSanitizedUser(user, aliasMap.get(String(user?.id || ""))));
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

  const mapped = rows.map((row) => mapFriendRequest(row, userId)).filter(Boolean);
  const peerIds = mapped.flatMap((row) => [row.senderId, row.receiverId]).filter((id) => id !== userId);
  const aliasMap = await buildFriendAliasMap(userId, peerIds);
  return mapped.map((row) => ({
    ...row,
    sender: decorateSanitizedUser(row.sender, aliasMap.get(row.senderId)),
    receiver: decorateSanitizedUser(row.receiver, aliasMap.get(row.receiverId)),
  }));
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

  const friendshipMap = new Map(friendships.map((row) => ([
    row.userLowId === userId ? row.userHighId : row.userLowId,
    row,
  ])));

  return users
    .filter((user) => {
      const friendship = friendshipMap.get(user.id) || null;
      const friendAlias = extractFriendAlias(friendship, userId);
      if (!search) return true;
      return [user.id, user.profile?.realName, user.profile?.bio, friendAlias]
        .some((value) => String(value || "").toLowerCase().includes(search));
    })
    .map((user) => {
      const request = requestMap.get(user.id) || null;
      const friendship = friendshipMap.get(user.id) || null;
      const isFriend = Boolean(friendship);
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
        user: decorateSanitizedUser(sanitizeUser(user), extractFriendAlias(friendship, userId)),
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

export async function updateFriendAlias(currentUserId, friendUserId, alias) {
  const friendship = await findFriendship(currentUserId, friendUserId);
  if (!friendship) return null;

  const data = friendship.userLowId === currentUserId
    ? { lowAlias: alias || null }
    : { highAlias: alias || null };

  return prisma.chatFriendship.update({
    where: { id: friendship.id },
    data,
  });
}

export async function removeFriendship(currentUserId, friendUserId) {
  const friendship = await findFriendship(currentUserId, friendUserId);
  if (!friendship) return false;

  await prisma.$transaction([
    prisma.chatFriendship.delete({
      where: { id: friendship.id },
    }),
    prisma.chatFriendRequest.deleteMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: friendUserId },
          { senderId: friendUserId, receiverId: currentUserId },
        ],
      },
    }),
  ]);
  return true;
}

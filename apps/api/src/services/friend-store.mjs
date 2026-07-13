import { prisma } from "../../../../infra/db/prisma.mjs";
import { buildFriendAliasMap, decorateUsersWithFriendAliases } from "./friend-aliases.mjs";
import { buildDiscoveryRows, decorateMappedRequests, mapFriendRequests } from "./friend-relationships.mjs";

function orderedFriendPair(userIdA, userIdB) {
  return [String(userIdA || ""), String(userIdB || "")].sort();
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
  const mapped = mapFriendRequests(rows, userId);
  const peerIds = mapped.flatMap((row) => [row.senderId, row.receiverId]).filter((id) => id !== userId);
  const aliasMap = await buildFriendAliasMap(userId, peerIds);
  return decorateMappedRequests(mapped, userId, aliasMap);
}

export async function listFriendDiscovery(userId, keyword = "") {
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
  return buildDiscoveryRows(users, requests, friendships, userId, keyword);
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

export { buildFriendAliasMap, decorateUsersWithFriendAliases };

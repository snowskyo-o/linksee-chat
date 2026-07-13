import { prisma } from "../../../../infra/db/prisma.mjs";

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

export { decorateSanitizedUser, extractFriendAlias };

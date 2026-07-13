import { prisma } from "../../../../infra/db/prisma.mjs";

export async function findUserWithProfile(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
}

export async function findVisibleProfileUsers(currentUserId, requestedIds) {
  const visibleRows = await prisma.chatConversationMember.findMany({
    where: {
      userId: currentUserId,
      conversation: { members: { some: { userId: { in: requestedIds } } } },
    },
    select: { conversation: { select: { members: { select: { userId: true } } } } },
  });
  const visibleIds = new Set([currentUserId]);
  visibleRows.forEach((row) => row.conversation.members.forEach((member) => visibleIds.add(member.userId)));

  return prisma.user.findMany({
    where: { id: { in: requestedIds.filter((id) => visibleIds.has(id)) }, isActive: true },
    include: { profile: true },
  });
}

export async function upsertUserProfile(userId, data) {
  return prisma.userProfile.upsert({
    where: { userId },
    ...data,
  });
}

export async function updateUserPassword(userId, passwordHash) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

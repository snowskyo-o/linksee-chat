import { prisma } from "../../../../infra/db/prisma.mjs";

export async function findChatFile(objectKey) {
  return prisma.chatFile.findUnique({
    where: { objectKey },
    include: {
      message: {
        include: {
          conversation: {
            include: { members: true },
          },
        },
      },
    },
  });
}

export function canAccessChatFile(file, userId) {
  return file.message.conversation.members.some((member) => member.userId === userId);
}

export function chatFileExpired(file) {
  return file.expiresAt.getTime() <= Date.now();
}

import { PrismaClient } from "@prisma/client";

export const prisma = globalThis.__linkseeChatPrisma || new PrismaClient();

if (!globalThis.__linkseeChatPrisma) {
  globalThis.__linkseeChatPrisma = prisma;
}

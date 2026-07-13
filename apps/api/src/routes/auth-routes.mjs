import { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { findUserById } from "../services/chat-store.mjs";
import { verifyPassword } from "../services/password-service.mjs";
import {
  findUserIdByRefreshToken,
  issueSession,
  revokeAccessToken,
  revokeRefreshToken,
} from "../services/session-store.mjs";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = await findUserById(userId);

  if (!user || !verifyPassword(password, user.passwordHash) || !user.isActive) {
    return res.status(401).json({ ok: false, code: "UNAUTHENTICATED", message: "账号或密码错误" });
  }

  const tokens = await issueSession(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return res.json({
    ok: true,
    data: {
      ...tokens,
      role: user.role,
      forceChangePassword: false,
    },
  });
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  const userId = await findUserIdByRefreshToken(refreshToken);
  if (!userId) {
    return res.status(401).json({ ok: false, code: "UNAUTHENTICATED", message: "Refresh token 无效" });
  }

  const user = await findUserById(userId);
  const tokens = await issueSession(userId);
  return res.json({
    ok: true,
    data: {
      ...tokens,
      role: user?.role || "member",
      forceChangePassword: false,
    },
  });
});

authRouter.post("/logout", async (req, res) => {
  const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  await revokeRefreshToken(refreshToken);
  if (req.header("authorization")?.startsWith("Bearer ")) {
    await revokeAccessToken(req.header("authorization").slice(7));
  }
  return res.json({ ok: true });
});

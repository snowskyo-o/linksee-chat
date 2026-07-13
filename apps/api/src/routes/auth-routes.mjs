import { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { findUserById } from "../services/chat-store.mjs";
import { hashPassword, verifyPassword } from "../services/password-service.mjs";
import {
  findUserIdByRefreshToken,
  issueSession,
  revokeAccessToken,
  revokeRefreshToken,
} from "../services/session-store.mjs";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  const realName = typeof req.body?.realName === "string" ? req.body.realName.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const bio = typeof req.body?.bio === "string" ? req.body.bio.trim() : "";

  if (!userId || !realName || !password) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "请填写账号、昵称和密码" });
  }
  if (!/^[A-Za-z0-9_]{4,32}$/.test(userId)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "账号需为 4 到 32 位字母、数字或下划线" });
  }
  if (realName.length > 40) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "昵称不能超过 40 个字符" });
  }
  if (bio.length > 1000) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "签名不能超过 1000 个字符" });
  }
  if (password.length < 6 || password.length > 64) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "密码长度需要在 6 到 64 位之间" });
  }

  const existing = await findUserById(userId);
  if (existing) {
    return res.status(409).json({ ok: false, code: "ALREADY_EXISTS", message: "账号已存在" });
  }

  await prisma.user.create({
    data: {
      id: userId,
      passwordHash: hashPassword(password),
      role: "member",
      profile: {
        create: {
          realName,
          bio,
        },
      },
    },
  });

  return res.status(201).json({
    ok: true,
    data: {
      userId,
      role: "member",
    },
  });
});

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

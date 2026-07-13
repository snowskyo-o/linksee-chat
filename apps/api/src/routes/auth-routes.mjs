import { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import {
  readLoginPayload,
  readRefreshToken,
  readRegisterPayload,
  unauthenticatedResponse,
  validateRegisterPayload,
} from "./auth-route-helpers.mjs";
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
  const { bio, password, realName, userId } = readRegisterPayload(req.body);
  const validationError = validateRegisterPayload({ bio, password, realName, userId });
  if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });

  const existing = await findUserById(userId);
  if (existing) return res.status(409).json({ ok: false, code: "ALREADY_EXISTS", message: "账号已存在" });

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
  const { password, userId } = readLoginPayload(req.body);
  const user = await findUserById(userId);
  if (!user || !verifyPassword(password, user.passwordHash) || !user.isActive) return res.status(401).json(unauthenticatedResponse());

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
  const refreshToken = readRefreshToken(req.body);
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
  const refreshToken = readRefreshToken(req.body);
  await revokeRefreshToken(refreshToken);
  if (req.header("authorization")?.startsWith("Bearer ")) {
    await revokeAccessToken(req.header("authorization").slice(7));
  }
  return res.json({ ok: true });
});

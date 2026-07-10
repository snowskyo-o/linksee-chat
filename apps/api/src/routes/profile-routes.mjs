import express, { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { env } from "../../../../infra/config/env.mjs";
import { minioClient } from "../../../../infra/storage/minio.mjs";
import { findUserById } from "../services/chat-store.mjs";

export const profileRouter = Router();
export const publicProfileRouter = Router();

async function streamUserAvatar(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { profile: true },
  });
  const avatarUrl = user?.profile?.avatarUrl || "";
  if (!avatarUrl) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "头像不存在" });
  }
  const objectKey = avatarUrl.replace(/^minio:/, "");
  const stream = await minioClient.getObject(env.minio.bucketAvatars, objectKey).catch(() => null);
  if (!stream) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "头像不存在" });
  }
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Type", "image/*");
  stream.pipe(res);
}

publicProfileRouter.get("/users/:userId/profile", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { profile: true },
  });

  if (!user || !user.isActive) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "用户不存在" });
  }

  return res.json({
    ok: true,
    data: {
      id: user.id,
      profile: {
        realName: user.profile?.realName || user.id,
        bio: user.profile?.bio || "",
        avatarUrl: user.profile?.avatarUrl
          ? `/api/v1/users/${encodeURIComponent(user.id)}/avatar`
          : "",
      },
    },
  });
});

profileRouter.get("/users/me", async (req, res) => {
  const user = await findUserById(req.userId);
  if (!user) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "用户不存在" });
  }

  return res.json({
    ok: true,
    data: {
      id: user.id,
      role: user.role,
      isActive: user.isActive,
      forceChangePassword: false,
      profile: {
        realName: user.profile?.realName || user.id,
        bio: user.profile?.bio || "",
        avatarUrl: user.profile?.avatarUrl
          ? `/api/v1/users/${encodeURIComponent(user.id)}/avatar`
          : "",
      },
    },
  });
});

profileRouter.patch("/users/me/profile", async (req, res) => {
  const realName = typeof req.body?.realName === "string" ? req.body.realName.trim() : "";
  const bio = typeof req.body?.bio === "string" ? req.body.bio.trim() : "";

  if (!realName) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "realName 必填" });
  }
  if (realName.length > 40) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "realName 不能超过 40 个字符" });
  }
  if (bio.length > 1000) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "bio 不能超过 1000 个字符" });
  }

  const updated = await prisma.userProfile.upsert({
    where: { userId: req.userId },
    update: { realName, bio },
    create: { userId: req.userId, realName, bio },
  });

  return res.json({ ok: true, data: { userId: req.userId, ...updated } });
});

publicProfileRouter.get("/users/:userId/avatar", streamUserAvatar);

profileRouter.post("/users/me/avatar", express.raw({
  type: () => true,
  limit: "5mb",
}), async (req, res) => {
  const fileName = decodeURIComponent(String(req.header("x-file-name") || "").trim());
  const mimeType = String(req.header("content-type") || "application/octet-stream").split(";")[0].trim();
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  if (!fileName || buffer.length === 0) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "头像文件不能为空" });
  }
  if (!mimeType.startsWith("image/")) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "头像必须是图片" });
  }
  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "头像不能超过 5MB" });
  }

  const objectKey = `avatars/${req.userId}/${Date.now()}-${fileName.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
  await minioClient.putObject(env.minio.bucketAvatars, objectKey, buffer, buffer.length, {
    "Content-Type": mimeType,
  });

  const stored = `minio:${objectKey}`;
  await prisma.userProfile.upsert({
    where: { userId: req.userId },
    update: { avatarUrl: stored },
    create: { userId: req.userId, realName: req.userId, avatarUrl: stored },
  });

  return res.json({
    ok: true,
    data: {
      avatarUrl: `/api/v1/users/${encodeURIComponent(req.userId)}/avatar`,
    },
  });
});

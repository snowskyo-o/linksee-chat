import express, { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { env } from "../../../../infra/config/env.mjs";
import { minioClient } from "../../../../infra/storage/minio.mjs";
import { findUserById } from "../services/chat-store.mjs";

export const publicProfileRouter = Router();

function publicAvatarUrl(userId) {
  return `/api/v1/users/${encodeURIComponent(userId)}/avatar`;
}

function serializePublicProfile(user) {
  return {
    id: user.id,
    profile: {
      realName: user.profile?.realName || user.id,
      bio: user.profile?.bio || "",
      avatarUrl: user.profile?.avatarUrl ? publicAvatarUrl(user.id) : "",
      profileVersion: Number(user.profile?.profileVersion || 0),
      avatarVersion: Number(user.profile?.avatarVersion || 0),
    },
  };
}

function emitProfileUpdate(emitUserProfileEvent, userId, profile) {
  if (typeof emitUserProfileEvent !== "function") return;
  emitUserProfileEvent(userId, "user.profile.dirty", {
    profileVersion: Number(profile?.profileVersion || 0),
    avatarVersion: Number(profile?.avatarVersion || 0),
  }).catch(() => {});
}

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
  const stat = await minioClient.statObject(env.minio.bucketAvatars, objectKey).catch(() => null);
  const stream = await minioClient.getObject(env.minio.bucketAvatars, objectKey).catch(() => null);
  if (!stream) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "头像不存在" });
  }
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Type", stat?.metaData?.["content-type"] || stat?.metaData?.["Content-Type"] || "application/octet-stream");
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

  return res.json({ ok: true, data: serializePublicProfile(user) });
});

publicProfileRouter.get("/users/:userId/avatar", streamUserAvatar);

export function createProfileRouter(emitUserProfileEvent) {
  const router = Router();

  router.get("/users/me", async (req, res) => {
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
      profile: serializePublicProfile(user).profile,
    },
  });
});

  router.post("/users/profiles/check", async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
    const requestedIds = [...new Set(items.map((item) => String(item?.userId || "").trim()).filter(Boolean))];
    if (!requestedIds.length) {
      return res.json({ ok: true, data: [] });
    }

    const visibleRows = await prisma.chatConversationMember.findMany({
      where: {
        userId: req.userId,
        conversation: {
          members: {
            some: { userId: { in: requestedIds } },
          },
        },
      },
      select: { conversation: { select: { members: { select: { userId: true } } } } },
    });
    const visibleIds = new Set([req.userId]);
    visibleRows.forEach((row) => {
      row.conversation.members.forEach((member) => visibleIds.add(member.userId));
    });

    const clientVersions = new Map(items.map((item) => [
      String(item?.userId || ""),
      {
        profileVersion: Number(item?.profileVersion || 0),
        avatarVersion: Number(item?.avatarVersion || 0),
      },
    ]));
    const users = await prisma.user.findMany({
      where: { id: { in: requestedIds.filter((id) => visibleIds.has(id)) }, isActive: true },
      include: { profile: true },
    });
    const changed = users
      .filter((user) => {
        const cached = clientVersions.get(user.id) || {};
        const serverProfileVersion = Number(user.profile?.profileVersion || 0);
        const serverAvatarVersion = Number(user.profile?.avatarVersion || 0);
        return serverProfileVersion > Number(cached.profileVersion || 0)
          || serverAvatarVersion > Number(cached.avatarVersion || 0);
      })
      .map(serializePublicProfile);

    return res.json({ ok: true, data: changed });
  });

  router.patch("/users/me/profile", async (req, res) => {
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
    update: { realName, bio, profileVersion: { increment: 1 } },
    create: { userId: req.userId, realName, bio, profileVersion: 1, avatarVersion: 1 },
  });

  emitProfileUpdate(emitUserProfileEvent, req.userId, updated);
  return res.json({ ok: true, data: { userId: req.userId, ...updated } });
});

  router.post("/users/me/avatar", express.raw({
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
  const updated = await prisma.userProfile.upsert({
    where: { userId: req.userId },
    update: { avatarUrl: stored, avatarVersion: { increment: 1 } },
    create: { userId: req.userId, realName: req.userId, avatarUrl: stored, profileVersion: 1, avatarVersion: 1 },
  });

  emitProfileUpdate(emitUserProfileEvent, req.userId, updated);
  return res.json({
    ok: true,
    data: {
      avatarUrl: publicAvatarUrl(req.userId),
      avatarVersion: Number(updated.avatarVersion || 0),
    },
  });
});

  return router;
}

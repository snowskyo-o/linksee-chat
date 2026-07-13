import { prisma } from "../../../../infra/db/prisma.mjs";
import { env } from "../../../../infra/config/env.mjs";
import { minioClient } from "../../../../infra/storage/minio.mjs";
import { findUserById } from "../services/chat-store.mjs";
import { hashPassword, verifyPassword } from "../services/password-service.mjs";
import {
  emitProfileUpdate,
  publicAvatarUrl,
  readAvatarUpload,
  readPasswordPayload,
  readProfilePayload,
  serializePublicProfile,
  validateAvatarUpload,
  validatePasswordPayload,
  validateProfilePayload,
} from "./profile-route-helpers.mjs";

export async function streamUserAvatar(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { profile: true },
  });
  const avatarUrl = user?.profile?.avatarUrl || "";
  if (!avatarUrl) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "头像不存在" });

  const objectKey = avatarUrl.replace(/^minio:/, "");
  const stat = await minioClient.statObject(env.minio.bucketAvatars, objectKey).catch(() => null);
  const stream = await minioClient.getObject(env.minio.bucketAvatars, objectKey).catch(() => null);
  if (!stream) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "头像不存在" });

  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Type", stat?.metaData?.["content-type"] || stat?.metaData?.["Content-Type"] || "application/octet-stream");
  stream.pipe(res);
}

export async function getPublicProfile(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { profile: true },
  });
  if (!user || !user.isActive) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "用户不存在" });
  return res.json({ ok: true, data: serializePublicProfile(user) });
}

export async function getCurrentUserProfile(req, res) {
  const user = await findUserById(req.userId);
  if (!user) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "用户不存在" });

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
}

export async function checkVisibleProfiles(req, res) {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
  const requestedIds = [...new Set(items.map((item) => String(item?.userId || "").trim()).filter(Boolean))];
  if (!requestedIds.length) return res.json({ ok: true, data: [] });

  const visibleRows = await prisma.chatConversationMember.findMany({
    where: {
      userId: req.userId,
      conversation: { members: { some: { userId: { in: requestedIds } } } },
    },
    select: { conversation: { select: { members: { select: { userId: true } } } } },
  });
  const visibleIds = new Set([req.userId]);
  visibleRows.forEach((row) => row.conversation.members.forEach((member) => visibleIds.add(member.userId)));

  const clientVersions = new Map(items.map((item) => [
    String(item?.userId || ""),
    { profileVersion: Number(item?.profileVersion || 0), avatarVersion: Number(item?.avatarVersion || 0) },
  ]));
  const users = await prisma.user.findMany({
    where: { id: { in: requestedIds.filter((id) => visibleIds.has(id)) }, isActive: true },
    include: { profile: true },
  });
  const changed = users
    .filter((user) => {
      const cached = clientVersions.get(user.id) || {};
      return Number(user.profile?.profileVersion || 0) > Number(cached.profileVersion || 0)
        || Number(user.profile?.avatarVersion || 0) > Number(cached.avatarVersion || 0);
    })
    .map(serializePublicProfile);

  return res.json({ ok: true, data: changed });
}

export function createPatchProfileHandler(emitUserProfileEvent) {
  return async (req, res) => {
    const { bio, realName } = readProfilePayload(req.body);
    const validationError = validateProfilePayload({ realName, bio });
    if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });

    const updated = await prisma.userProfile.upsert({
      where: { userId: req.userId },
      update: { realName, bio, profileVersion: { increment: 1 } },
      create: { userId: req.userId, realName, bio, profileVersion: 1, avatarVersion: 1 },
    });

    emitProfileUpdate(emitUserProfileEvent, req.userId, updated);
    return res.json({ ok: true, data: { userId: req.userId, ...updated } });
  };
}

export async function patchPassword(req, res) {
  const { currentPassword, nextPassword } = readPasswordPayload(req.body);
  const validationError = validatePasswordPayload({ currentPassword, nextPassword });
  if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });

  const user = await findUserById(req.userId);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "当前密码不正确" });
  }

  await prisma.user.update({
    where: { id: req.userId },
    data: { passwordHash: hashPassword(nextPassword) },
  });
  return res.json({ ok: true, data: { userId: req.userId, changed: true } });
}

export function createUploadAvatarHandler(emitUserProfileEvent) {
  return async (req, res) => {
    const { buffer, fileName, mimeType } = readAvatarUpload(req);
    const validationError = validateAvatarUpload({ buffer, fileName, mimeType });
    if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });

    const objectKey = `avatars/${req.userId}/${Date.now()}-${fileName.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
    await minioClient.putObject(env.minio.bucketAvatars, objectKey, buffer, buffer.length, { "Content-Type": mimeType });

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
  };
}

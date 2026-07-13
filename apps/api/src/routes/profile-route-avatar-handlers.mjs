import { env } from "../../../../infra/config/env.mjs";
import { minioClient } from "../../../../infra/storage/minio.mjs";
import { emitProfileUpdate, publicAvatarUrl, readAvatarUpload, validateAvatarUpload } from "./profile-route-helpers.mjs";
import { findUserWithProfile, upsertUserProfile } from "./profile-route-records.mjs";

export async function streamUserAvatar(req, res) {
  const user = await findUserWithProfile(req.params.userId);
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

export function createUploadAvatarHandler(emitUserProfileEvent) {
  return async (req, res) => {
    const { buffer, fileName, mimeType } = readAvatarUpload(req);
    const validationError = validateAvatarUpload({ buffer, fileName, mimeType });
    if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });

    const objectKey = `avatars/${req.userId}/${Date.now()}-${fileName.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
    await minioClient.putObject(env.minio.bucketAvatars, objectKey, buffer, buffer.length, { "Content-Type": mimeType });

    const stored = `minio:${objectKey}`;
    const updated = await upsertUserProfile(req.userId, {
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

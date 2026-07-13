import { findUserById } from "../services/chat-store.mjs";
import { hashPassword, verifyPassword } from "../services/password-service.mjs";
import {
  emitProfileUpdate,
  readPasswordPayload,
  readProfilePayload,
  serializePublicProfile,
  validatePasswordPayload,
  validateProfilePayload,
} from "./profile-route-helpers.mjs";
import { findUserWithProfile, findVisibleProfileUsers, updateUserPassword, upsertUserProfile } from "./profile-route-records.mjs";
import { createUploadAvatarHandler, streamUserAvatar } from "./profile-route-avatar-handlers.mjs";
import { buildClientProfileVersions, buildRequestedProfileIds, filterChangedProfiles } from "./profile-route-visibility.mjs";

export async function getPublicProfile(req, res) {
  const user = await findUserWithProfile(req.params.userId);
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
  const requestedIds = buildRequestedProfileIds(items);
  if (!requestedIds.length) return res.json({ ok: true, data: [] });
  const clientVersions = buildClientProfileVersions(items);
  const users = await findVisibleProfileUsers(req.userId, requestedIds);
  const changed = filterChangedProfiles(users, clientVersions).map(serializePublicProfile);

  return res.json({ ok: true, data: changed });
}

export function createPatchProfileHandler(emitUserProfileEvent) {
  return async (req, res) => {
    const { bio, realName } = readProfilePayload(req.body);
    const validationError = validateProfilePayload({ realName, bio });
    if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });

    const updated = await upsertUserProfile(req.userId, {
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
  await updateUserPassword(req.userId, hashPassword(nextPassword));
  return res.json({ ok: true, data: { userId: req.userId, changed: true } });
}

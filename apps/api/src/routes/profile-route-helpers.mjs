export function publicAvatarUrl(userId) {
  return `/api/v1/users/${encodeURIComponent(userId)}/avatar`;
}

export function serializePublicProfile(user) {
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

export function emitProfileUpdate(emitUserProfileEvent, userId, profile) {
  if (typeof emitUserProfileEvent !== "function") return;
  emitUserProfileEvent(userId, "user.profile.dirty", {
    profileVersion: Number(profile?.profileVersion || 0),
    avatarVersion: Number(profile?.avatarVersion || 0),
  }).catch(() => {});
}

export function readProfilePayload(body) {
  return {
    bio: typeof body?.bio === "string" ? body.bio.trim() : "",
    realName: typeof body?.realName === "string" ? body.realName.trim() : "",
  };
}

export function validateProfilePayload({ realName, bio }) {
  if (!realName) return "realName 必填";
  if (realName.length > 40) return "realName 不能超过 40 个字符";
  if (bio.length > 1000) return "bio 不能超过 1000 个字符";
  return "";
}

export function readPasswordPayload(body) {
  return {
    currentPassword: typeof body?.currentPassword === "string" ? body.currentPassword : "",
    nextPassword: typeof body?.nextPassword === "string" ? body.nextPassword : "",
  };
}

export function validatePasswordPayload({ currentPassword, nextPassword }) {
  if (!currentPassword || !nextPassword) return "请填写当前密码和新密码";
  if (nextPassword.length < 6) return "新密码至少需要 6 位";
  if (nextPassword.length > 64) return "新密码不能超过 64 位";
  if (currentPassword === nextPassword) return "新密码不能与当前密码相同";
  return "";
}

export function readAvatarUpload(req) {
  return {
    buffer: Buffer.isBuffer(req.body) ? req.body : Buffer.from([]),
    fileName: decodeURIComponent(String(req.header("x-file-name") || "").trim()),
    mimeType: String(req.header("content-type") || "application/octet-stream").split(";")[0].trim(),
  };
}

export function validateAvatarUpload({ fileName, mimeType, buffer }) {
  if (!fileName || buffer.length === 0) return "头像文件不能为空";
  if (!mimeType.startsWith("image/")) return "头像必须是图片";
  if (buffer.length > 5 * 1024 * 1024) return "头像不能超过 5MB";
  return "";
}

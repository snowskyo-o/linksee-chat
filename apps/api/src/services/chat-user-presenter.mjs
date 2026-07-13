export function publicAvatarUrl(user) {
  if (!user?.profile?.avatarUrl) return "";
  if (String(user.profile.avatarUrl).startsWith("minio:")) {
    return `/api/v1/users/${encodeURIComponent(user.id)}/avatar`;
  }
  return user.profile.avatarUrl;
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    profile: {
      realName: user.profile?.realName || user.id,
      bio: user.profile?.bio || "",
      avatarUrl: publicAvatarUrl(user),
    },
  };
}

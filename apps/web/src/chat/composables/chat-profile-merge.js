function normalizeText(value) {
  return String(value || "").trim();
}

function isMeaningfulValue(value, fallback = "") {
  const normalized = normalizeText(value);
  return Boolean(normalized) && normalized !== normalizeText(fallback);
}

function pickVersionedProfileField({
  cachedValue,
  serverValue,
  cachedVersion,
  serverVersion,
  fallbackValue = "",
  isMeaningful = (value) => isMeaningfulValue(value, fallbackValue),
}) {
  if (serverVersion > cachedVersion) return serverValue ?? fallbackValue;
  if (cachedVersion > serverVersion) return cachedValue || serverValue || fallbackValue;
  const serverWins = isMeaningful(serverValue) && !isMeaningful(cachedValue);
  const cachedWins = isMeaningful(cachedValue) && !isMeaningful(serverValue);
  if (serverWins) return serverValue;
  if (cachedWins) return cachedValue;
  return serverValue || cachedValue || fallbackValue;
}

export function mergeUserProfile(cachedUser, serverUser, fallbackUserId = "") {
  const cachedProfile = cachedUser?.profile || {};
  const serverProfile = serverUser?.profile || {};
  const userId = String(serverUser?.id || cachedUser?.id || fallbackUserId || "").trim();
  const cachedProfileVersion = Number(cachedProfile.profileVersion || 0);
  const serverProfileVersion = Number(serverProfile.profileVersion || 0);
  const cachedAvatarVersion = Number(cachedProfile.avatarVersion || 0);
  const serverAvatarVersion = Number(serverProfile.avatarVersion || 0);

  return {
    ...(cachedUser || {}),
    ...(serverUser || {}),
    id: userId,
    profile: {
      ...cachedProfile,
      ...serverProfile,
      realName: pickVersionedProfileField({
        cachedValue: cachedProfile.realName,
        serverValue: serverProfile.realName,
        cachedVersion: cachedProfileVersion,
        serverVersion: serverProfileVersion,
        fallbackValue: userId,
      }),
      originalRealName: pickVersionedProfileField({
        cachedValue: cachedProfile.originalRealName || cachedProfile.realName,
        serverValue: serverProfile.originalRealName || serverProfile.realName,
        cachedVersion: cachedProfileVersion,
        serverVersion: serverProfileVersion,
        fallbackValue: userId,
      }),
      bio: pickVersionedProfileField({
        cachedValue: cachedProfile.bio,
        serverValue: serverProfile.bio,
        cachedVersion: cachedProfileVersion,
        serverVersion: serverProfileVersion,
      }),
      avatarUrl: pickVersionedProfileField({
        cachedValue: cachedProfile.avatarUrl,
        serverValue: serverProfile.avatarUrl,
        cachedVersion: cachedAvatarVersion,
        serverVersion: serverAvatarVersion,
      }),
      profileVersion: Math.max(cachedProfileVersion, serverProfileVersion),
      avatarVersion: Math.max(cachedAvatarVersion, serverAvatarVersion),
    },
  };
}

export function mergeUsersById(cachedUsers = [], serverUsers = []) {
  const cachedMap = new Map((Array.isArray(cachedUsers) ? cachedUsers : []).map((user) => [String(user?.id || ""), user]));
  return (Array.isArray(serverUsers) ? serverUsers : []).map((user) => {
    const userId = String(user?.id || "");
    return mergeUserProfile(cachedMap.get(userId), user, userId);
  });
}

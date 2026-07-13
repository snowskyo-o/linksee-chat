export function buildRequestedProfileIds(items) {
  return [...new Set(items.map((item) => String(item?.userId || "").trim()).filter(Boolean))];
}

export function buildClientProfileVersions(items) {
  return new Map(items.map((item) => [
    String(item?.userId || ""),
    { profileVersion: Number(item?.profileVersion || 0), avatarVersion: Number(item?.avatarVersion || 0) },
  ]));
}

export function filterChangedProfiles(users, clientVersions) {
  return users.filter((user) => {
    const cached = clientVersions.get(user.id) || {};
    return Number(user.profile?.profileVersion || 0) > Number(cached.profileVersion || 0)
      || Number(user.profile?.avatarVersion || 0) > Number(cached.avatarVersion || 0);
  });
}

export function normalizeFriendCenterPerson(user) {
  return {
    id: String(user?.id || ""),
    name: user?.profile?.realName || user?.id || "未命名用户",
    originalName: user?.profile?.originalRealName || user?.profile?.realName || user?.id || "",
    friendAlias: user?.friendAlias || "",
    bio: user?.profile?.bio || "",
    avatarUrl: user?.profile?.avatarUrl || "",
  };
}

export function includesFriendCenterKeyword(keyword, ...values) {
  const search = String(keyword || "").trim().toLowerCase();
  if (!search) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(search));
}

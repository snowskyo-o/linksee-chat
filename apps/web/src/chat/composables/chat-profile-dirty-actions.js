import { appendCacheBust } from "../../shared/media.js";

function listKnownProfileUsers(store, userIds = []) {
  const wanted = new Set(userIds.map((id) => String(id || "")).filter(Boolean));
  const byId = new Map();
  const collect = (user) => {
    if (!user?.id) return;
    if (wanted.size && !wanted.has(String(user.id))) return;
    byId.set(String(user.id), user);
  };
  collect(store.me.value);
  store.contacts.value.forEach(collect);
  store.participants.value.forEach(collect);
  store.conversations.value.forEach((conversation) => (conversation.participants || []).forEach(collect));
  store.messages.value.forEach((message) => {
    collect(message.sender);
    collect(message.replyTo?.sender);
  });
  return Array.from(byId.values());
}

function buildRemoteProfilePatch(user) {
  const profile = user.profile || {};
  return {
    realName: profile.realName,
    originalRealName: profile.originalRealName || profile.realName,
    bio: profile.bio || "",
    avatarUrl: profile.avatarUrl ? appendCacheBust(profile.avatarUrl, profile.avatarVersion || Date.now()) : "",
    profileVersion: Number(profile.profileVersion || 0),
    avatarVersion: Number(profile.avatarVersion || 0),
  };
}

export function createChatProfileDirtyActions({ store, chatApi, dirtyProfileUserIds, applyUserProfileUpdate }) {
  function markProfileDirty(userId) {
    const targetUserId = String(userId || "");
    if (targetUserId) dirtyProfileUserIds.add(targetUserId);
  }

  async function refreshProfilesIfDirty(userIds = []) {
    const targetIds = userIds.map((id) => String(id || "")).filter(Boolean);
    const ids = targetIds.length ? targetIds.filter((id) => dirtyProfileUserIds.has(id)) : Array.from(dirtyProfileUserIds);
    if (!ids.length) return;
    const items = listKnownProfileUsers(store, ids).map((user) => ({
      userId: user.id,
      profileVersion: Number(user.profile?.profileVersion || 0),
      avatarVersion: Number(user.profile?.avatarVersion || 0),
    }));
    if (!items.length) return;
    const payload = await chatApi.postJson("/api/v1/users/profiles/check", { items });
    (Array.isArray(payload.data) ? payload.data : []).forEach((user) => applyUserProfileUpdate(user.id, buildRemoteProfilePatch(user)));
    ids.forEach((id) => dirtyProfileUserIds.delete(id));
  }

  return {
    markProfileDirty,
    refreshProfilesIfDirty,
  };
}

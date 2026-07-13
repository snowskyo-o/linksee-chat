import { appendCacheBust } from "../../shared/media.js";
import { writeChatCache } from "./local-chat-cache.js";
import { normalizeUser, patchUserProfileLocally } from "./message-operations.js";

export function createChatProfileActions({ store, dataActions, chatApi, cacheUserId, dirtyProfileUserIds }) {
  function persistSidebarCaches() {
    const userId = cacheUserId();
    writeChatCache(userId, "profile", {
      data: store.me.value || {},
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
    writeChatCache(userId, "contacts", {
      data: store.contacts.value || [],
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
    writeChatCache(userId, "conversations", {
      data: store.conversations.value || [],
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
    if (store.selectedId.value) {
      writeChatCache(userId, `participants-${store.selectedId.value}`, {
        data: store.participants.value || [],
        cachedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  function applyUserProfileUpdate(userId, profilePatch) {
    const targetUserId = String(userId || "");
    if (!targetUserId) return;
    patchUserProfileLocally(store, targetUserId, profilePatch);
    if (store.me.value) store.me.value = normalizeUser(store.me.value);
    store.contacts.value = store.contacts.value.map((user) => normalizeUser(user));
    store.participants.value = store.participants.value.map((user) => normalizeUser(user));
    if (String(store.me.value?.id || "") === targetUserId) {
      store.profileName.value = store.me.value?.profile?.realName || store.profileName.value;
      store.profileBio.value = store.me.value?.profile?.bio || "";
      document.title = `Linksee Chat · ${store.profileName.value}`;
    }
    persistSidebarCaches();
  }

  function syncCurrentUserProfileLocally(profilePatch) {
    const targetUserId = store.me.value?.id || localStorage.getItem("chat_user_id") || "";
    if (!targetUserId) return;
    applyUserProfileUpdate(targetUserId, profilePatch);
  }

  function getKnownProfileUsers(userIds = []) {
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
    store.conversations.value.forEach((conversation) => {
      (conversation.participants || []).forEach(collect);
    });
    store.messages.value.forEach((message) => {
      collect(message.sender);
      collect(message.replyTo?.sender);
    });
    return Array.from(byId.values());
  }

  function markProfileDirty(userId) {
    const targetUserId = String(userId || "");
    if (targetUserId) dirtyProfileUserIds.add(targetUserId);
  }

  async function refreshProfilesIfDirty(userIds = []) {
    const targetIds = userIds.map((id) => String(id || "")).filter(Boolean);
    const ids = targetIds.length
      ? targetIds.filter((id) => dirtyProfileUserIds.has(id))
      : Array.from(dirtyProfileUserIds);
    if (!ids.length) return;

    const items = getKnownProfileUsers(ids).map((user) => ({
      userId: user.id,
      profileVersion: Number(user.profile?.profileVersion || 0),
      avatarVersion: Number(user.profile?.avatarVersion || 0),
    }));
    if (!items.length) return;

    const payload = await chatApi.postJson("/api/v1/users/profiles/check", { items });
    const changed = Array.isArray(payload.data) ? payload.data : [];
    changed.forEach((user) => {
      const profile = user.profile || {};
      applyUserProfileUpdate(user.id, {
        realName: profile.realName,
        originalRealName: profile.originalRealName || profile.realName,
        bio: profile.bio || "",
        avatarUrl: profile.avatarUrl
          ? appendCacheBust(profile.avatarUrl, profile.avatarVersion || Date.now())
          : "",
        profileVersion: Number(profile.profileVersion || 0),
        avatarVersion: Number(profile.avatarVersion || 0),
      });
    });
    ids.forEach((id) => dirtyProfileUserIds.delete(id));
  }

  async function saveProfile() {
    const payload = await chatApi.patchJson("/api/v1/users/me/profile", {
      realName: store.profileName.value.trim(),
      bio: store.profileBio.value.trim(),
    });
    syncCurrentUserProfileLocally({
      realName: payload.data?.realName || store.profileName.value.trim(),
      originalRealName: payload.data?.originalRealName || payload.data?.realName || store.profileName.value.trim(),
      bio: payload.data?.bio ?? store.profileBio.value.trim(),
      profileVersion: Number(payload.data?.profileVersion || store.me.value?.profile?.profileVersion || 0),
      avatarVersion: Number(payload.data?.avatarVersion || store.me.value?.profile?.avatarVersion || 0),
    });
    store.profileHint.value = "资料已保存";
    store.profileHintTone.value = "success";
    document.title = `Linksee Chat · ${store.profileName.value}`;
    Promise.allSettled([
      dataActions.loadContacts(),
      dataActions.loadConversations(),
      dataActions.loadParticipants(),
    ]).then(() => {
      persistSidebarCaches();
    });
  }

  async function uploadAvatar(file) {
    if (!file) return;
    const payload = await chatApi.postBinary("/api/v1/users/me/avatar", file, {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name || "avatar"),
    });
    const refreshedUrl = appendCacheBust(payload.data?.avatarUrl || "", Date.now());
    syncCurrentUserProfileLocally({
      avatarUrl: refreshedUrl,
      avatarVersion: Number(payload.data?.avatarVersion || store.me.value?.profile?.avatarVersion || 0),
    });
    store.profileHint.value = "头像已上传";
    store.profileHintTone.value = "success";
    Promise.allSettled([
      dataActions.loadProfile({ userId: store.me.value?.id || localStorage.getItem("chat_user_id") || "" }),
      dataActions.loadContacts(),
      dataActions.loadConversations(),
      dataActions.loadParticipants(),
    ]).then(() => {
      syncCurrentUserProfileLocally({
        avatarUrl: refreshedUrl,
        avatarVersion: Number(payload.data?.avatarVersion || store.me.value?.profile?.avatarVersion || 0),
      });
    });
  }

  return {
    applyUserProfileUpdate,
    markProfileDirty,
    persistSidebarCaches,
    refreshProfilesIfDirty,
    saveProfile,
    syncCurrentUserProfileLocally,
    uploadAvatar,
  };
}

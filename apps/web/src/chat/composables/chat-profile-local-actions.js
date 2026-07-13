import { normalizeUser, patchUserProfileLocally } from "./message-operations.js";

function refreshSelfProfileUi(store) {
  store.profileName.value = store.me.value?.profile?.realName || store.profileName.value;
  store.profileBio.value = store.me.value?.profile?.bio || "";
  document.title = `Linksee Chat · ${store.profileName.value}`;
}

export function createChatProfileLocalActions({ store, persistSidebarCaches }) {
  function applyUserProfileUpdate(userId, profilePatch) {
    const targetUserId = String(userId || "");
    if (!targetUserId) return;
    patchUserProfileLocally(store, targetUserId, profilePatch);
    if (store.me.value) store.me.value = normalizeUser(store.me.value);
    store.contacts.value = store.contacts.value.map(normalizeUser);
    store.participants.value = store.participants.value.map(normalizeUser);
    if (String(store.me.value?.id || "") === targetUserId) refreshSelfProfileUi(store);
    persistSidebarCaches();
  }

  function syncCurrentUserProfileLocally(profilePatch) {
    const targetUserId = store.me.value?.id || localStorage.getItem("chat_user_id") || "";
    if (targetUserId) applyUserProfileUpdate(targetUserId, profilePatch);
  }

  return {
    applyUserProfileUpdate,
    syncCurrentUserProfileLocally,
  };
}

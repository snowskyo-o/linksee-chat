import { appendCacheBust } from "../../shared/media.js";
import { syncChatDocumentTitle } from "./chat-document-title.js";

export function createChatProfileSubmitActions({
  store,
  dataActions,
  chatApi,
  persistSidebarCaches,
  syncCurrentUserProfileLocally,
}) {
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
    syncChatDocumentTitle({
      chatTitle: store.chatTitle.value,
      hasConversation: Boolean(store.selectedConversation.value),
      profileName: store.profileName.value,
    });
    Promise.allSettled([dataActions.loadContacts(), dataActions.loadConversations(), dataActions.loadParticipants()]).then(persistSidebarCaches);
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
    saveProfile,
    uploadAvatar,
  };
}

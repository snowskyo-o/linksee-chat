import { normalizeMessage, normalizeUser, patchConversationLocally } from "./message-operations.js";
import { readDraftAttachments, writeDraftAttachments } from "./draft-attachments-cache.js";
import { restorePendingAttachment } from "./file-attachments.js";
import { readChatCache, writeChatCache } from "./local-chat-cache.js";
import { applyLocalConversationVisibility, filterLocallyVisibleMessages } from "./message-visibility-cache.js";

function pickVersionedField(cachedValue, serverValue, shouldUseServer, fallbackValue = "") {
  if (shouldUseServer) return serverValue || fallbackValue;
  return cachedValue || serverValue || fallbackValue;
}

function mergeSelfProfile(cachedUser, serverUser, fallbackUserId = "") {
  const cachedProfile = cachedUser?.profile || {};
  const serverProfile = serverUser?.profile || {};
  const cachedProfileVersion = Number(cachedProfile.profileVersion || 0);
  const serverProfileVersion = Number(serverProfile.profileVersion || 0);
  const cachedAvatarVersion = Number(cachedProfile.avatarVersion || 0);
  const serverAvatarVersion = Number(serverProfile.avatarVersion || 0);
  const useServerProfile = serverProfileVersion > cachedProfileVersion;
  const useServerAvatar = serverAvatarVersion > cachedAvatarVersion;
  const userId = String(serverUser?.id || cachedUser?.id || fallbackUserId || "").trim();

  return {
    ...(cachedUser || {}),
    ...(serverUser || {}),
    id: userId,
    profile: {
      ...cachedProfile,
      ...serverProfile,
      realName: pickVersionedField(cachedProfile.realName, serverProfile.realName, useServerProfile, userId),
      originalRealName: pickVersionedField(
        cachedProfile.originalRealName || cachedProfile.realName,
        serverProfile.originalRealName || serverProfile.realName,
        useServerProfile,
        userId,
      ),
      bio: pickVersionedField(cachedProfile.bio, serverProfile.bio, useServerProfile, ""),
      avatarUrl: pickVersionedField(cachedProfile.avatarUrl, serverProfile.avatarUrl, useServerAvatar, ""),
      profileVersion: Math.max(cachedProfileVersion, serverProfileVersion),
      avatarVersion: Math.max(cachedAvatarVersion, serverAvatarVersion),
    },
  };
}

export function createChatDataActions(store, chatApi) {
  const cacheUserId = () => store.me.value?.id || localStorage.getItem("chat_user_id") || "guest";
  const getDraftCacheKey = (conversationId) => `draft-${conversationId}`;
  const setLoadState = (target, status, message = "") => {
    target.value = { status, message };
  };

  async function saveConversationDraft(conversationId, draft = "", pendingFiles = []) {
    const targetId = String(conversationId || "").trim();
    if (!targetId) return;
    const userId = cacheUserId();
    await Promise.allSettled([
      writeChatCache(userId, getDraftCacheKey(targetId), {
        data: {
          text: String(draft || ""),
        },
        cachedAt: new Date().toISOString(),
      }).catch(() => {}),
      writeDraftAttachments(userId, targetId, pendingFiles).catch(() => false),
    ]);
  }

  async function loadConversationDraft(conversationId) {
    const targetId = String(conversationId || "").trim();
    if (!targetId) return { text: "", files: [] };
    const userId = cacheUserId();
    const [cached, draftFiles] = await Promise.all([
      readChatCache(userId, getDraftCacheKey(targetId)),
      readDraftAttachments(userId, targetId),
    ]);
    return {
      text: String(cached?.data?.text || ""),
      files: draftFiles.map((entry) => restorePendingAttachment(entry)).filter(Boolean),
    };
  }

  async function loadProfile(auth) {
    const cached = await readChatCache(cacheUserId(), "profile");
    if (cached?.data) {
      store.me.value = normalizeUser(cached.data || {});
      store.profileName.value = store.me.value.profile?.realName || auth.userId;
      store.profileBio.value = store.me.value.profile?.bio || "";
      document.title = `Linksee Chat · ${store.profileName.value}`;
    }
    const payload = await chatApi.getJson("/api/v1/users/me");
    const mergedProfile = mergeSelfProfile(cached?.data || null, payload.data || null, auth.userId);
    store.me.value = normalizeUser(mergedProfile);
    store.profileName.value = store.me.value.profile?.realName || auth.userId;
    store.profileBio.value = store.me.value.profile?.bio || "";
    document.title = `Linksee Chat · ${store.profileName.value}`;
    writeChatCache(cacheUserId(), "profile", { data: mergedProfile, cachedAt: new Date().toISOString() }).catch(() => {});
  }

  async function loadContacts() {
    const cached = await readChatCache(cacheUserId(), "contacts");
    if (Array.isArray(cached?.data) && cached.data.length && !store.contacts.value.length) {
      store.contacts.value = cached.data.map(normalizeUser);
    }
    const payload = await chatApi.getJson("/api/v1/contacts");
    store.contacts.value = (Array.isArray(payload.data) ? payload.data : []).map(normalizeUser);
    writeChatCache(cacheUserId(), "contacts", { data: payload.data || [], cachedAt: new Date().toISOString() }).catch(() => {});
  }

  async function loadConversations() {
    if (!store.conversations.value.length) setLoadState(store.conversationLoadState, "loading");
    const cached = await readChatCache(cacheUserId(), "conversations");
    if (Array.isArray(cached?.data) && cached.data.length && !store.conversations.value.length) {
      store.conversations.value = applyLocalConversationVisibility(cacheUserId(), cached.data);
      setLoadState(store.conversationLoadState, "ready");
    }
    try {
      const payload = await chatApi.getJson("/api/v1/conversations");
      store.conversations.value = applyLocalConversationVisibility(cacheUserId(), payload.data);
      writeChatCache(cacheUserId(), "conversations", { data: store.conversations.value, cachedAt: new Date().toISOString() }).catch(() => {});
      setLoadState(store.conversationLoadState, "ready");
      if (!store.selectedId.value && store.conversations.value.length) {
        store.selectedId.value = store.conversations.value[0].id;
      }
      if (store.selectedId.value && !store.conversations.value.find((item) => item.id === store.selectedId.value)) {
        store.selectedId.value = store.conversations.value[0]?.id || "";
      }
    } catch (error) {
      if (!store.conversations.value.length) {
        setLoadState(store.conversationLoadState, "error", error?.message || "加载会话失败，请重试");
      }
      throw error;
    }
  }

  async function loadParticipants() {
    if (!store.selectedId.value) {
      store.participants.value = [];
      return;
    }
    const cached = await readChatCache(cacheUserId(), `participants-${store.selectedId.value}`);
    if (Array.isArray(cached?.data) && cached.data.length && !store.participants.value.length) {
      store.participants.value = cached.data.map(normalizeUser);
    }
    const payload = await chatApi.getJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/participants`);
    store.participants.value = (Array.isArray(payload.data) ? payload.data : []).map(normalizeUser);
    writeChatCache(cacheUserId(), `participants-${store.selectedId.value}`, {
      data: payload.data || [],
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  async function loadMessages() {
    if (!store.selectedId.value) {
      store.messages.value = [];
      store.hasMoreMessages.value = false;
      setLoadState(store.messageLoadState, "ready");
      return;
    }
    if (!store.messages.value.length) setLoadState(store.messageLoadState, "loading");
    const canUseCache = !store.searchKeyword.value;
    if (canUseCache) {
      const cached = await readChatCache(cacheUserId(), `messages-${store.selectedId.value}`);
      if (Array.isArray(cached?.data) && cached.data.length && !store.messages.value.length) {
        store.messages.value = filterLocallyVisibleMessages(cacheUserId(), store.selectedId.value, cached.data).map(normalizeMessage);
        store.hasMoreMessages.value = Boolean(cached?.hasMoreMessages);
        setLoadState(store.messageLoadState, "ready");
      }
    }
    const path = store.searchKeyword.value
      ? `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/search?q=${encodeURIComponent(store.searchKeyword.value)}`
      : `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages?limit=50`;
    try {
      const payload = await chatApi.getJson(path);
      const visibleMessages = filterLocallyVisibleMessages(cacheUserId(), store.selectedId.value, payload.data);
      store.messages.value = visibleMessages.map(normalizeMessage);
      store.hasMoreMessages.value = !store.searchKeyword.value && store.messages.value.length >= 50;
      setLoadState(store.messageLoadState, "ready");
      if (!store.searchKeyword.value) {
        writeChatCache(cacheUserId(), `messages-${store.selectedId.value}`, {
          data: visibleMessages,
          hasMoreMessages: store.hasMoreMessages.value,
          cachedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (error) {
      if (!store.messages.value.length) {
        setLoadState(store.messageLoadState, "error", error?.message || "加载消息失败，请重试");
      }
      throw error;
    }
  }

  async function loadOlderMessages() {
    if (!store.selectedId.value || store.searchKeyword.value || !store.messages.value.length) return;
    const oldest = store.messages.value[0];
    if (!oldest?.id) return;
    store.loadingMoreMessages.value = true;
    try {
      const payload = await chatApi.getJson(
        `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages?beforeId=${encodeURIComponent(oldest.id)}&limit=50`,
      );
      const older = filterLocallyVisibleMessages(cacheUserId(), store.selectedId.value, payload.data).map(normalizeMessage);
      store.messages.value = [...older, ...store.messages.value];
      store.hasMoreMessages.value = older.length >= 50;
      writeChatCache(cacheUserId(), `messages-${store.selectedId.value}`, {
        data: store.messages.value,
        hasMoreMessages: store.hasMoreMessages.value,
        cachedAt: new Date().toISOString(),
      }).catch(() => {});
    } finally {
      store.loadingMoreMessages.value = false;
    }
  }

  async function refreshSelectedConversation() {
    await loadParticipants();
    await loadMessages();
  }

  async function refreshAll() {
    await loadContacts();
    await loadConversations();
    await refreshSelectedConversation();
  }

  async function markConversationReadIfNeeded() {
    const selected = store.selectedConversation.value;
    const lastMessage = store.messages.value[store.messages.value.length - 1];
    if (!selected || !lastMessage?.id) return;
    if (!selected.unreadCount && !selected.unreadMentionCount) return;
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(selected.id)}/read`, {
      messageId: lastMessage.id,
    });
    patchConversationLocally(store, selected.id, {
      unreadCount: 0,
      unreadMentionCount: 0,
      lastReadAt: new Date().toISOString(),
    });
  }

  async function selectConversation(id) {
    const previousId = String(store.selectedId.value || "").trim();
    if (previousId) {
      await saveConversationDraft(previousId, store.messageInput.value, store.pendingFiles.value);
    }
    store.selectedId.value = id;
    store.searchKeyword.value = "";
    store.messageKeyword.value = "";
    store.participants.value = [];
    store.messages.value = [];
    store.hasMoreMessages.value = false;
    store.clearReplyState();
    store.messageInput.value = "";
    store.clearPendingFiles();
    await refreshSelectedConversation();
    const draft = await loadConversationDraft(id);
    store.messageInput.value = draft.text || "";
    store.pendingFiles.value = Array.isArray(draft.files) ? draft.files : [];
    store.updateMentionState(store.messageInput.value);
    await markConversationReadIfNeeded().catch(() => {});
  }

  async function searchMessages() {
    store.searchKeyword.value = store.messageKeyword.value.trim();
    await loadMessages();
  }

  return {
    loadProfile,
    loadContacts,
    loadConversations,
    loadParticipants,
    loadMessages,
    loadOlderMessages,
    refreshSelectedConversation,
    refreshAll,
    markConversationReadIfNeeded,
    saveConversationDraft,
    loadConversationDraft,
    selectConversation,
    searchMessages,
  };
}

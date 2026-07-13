<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AvatarImage from "../shared/components/AvatarImage.vue";
import ContactDirectoryPanel from "./components/ContactDirectoryPanel.vue";
import ConversationThreadList from "./components/ConversationThreadList.vue";
import CreateConversationDialog from "./components/CreateConversationDialog.vue";
import ListSearchPanel from "./components/ListSearchPanel.vue";
import NewFriendsDialog from "./components/NewFriendsDialog.vue";
import QuickCreateMenu from "./components/QuickCreateMenu.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import FriendRemarkDialog from "./components/FriendRemarkDialog.vue";
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { clearAppLogs, onAppLogsUpdated, readAppLogs } from "../shared/app-log.js";
import { appendCacheBust } from "../shared/media.js";
import { getAuth, logout } from "../shared/session.js";
import { loadAppSettings, saveAppSettings } from "../shared/app-settings.js";
import { useChatStore } from "./store/useChatStore.js";
import { useChatActions } from "./composables/useChatActions.js";
import { useChatRealtime } from "./composables/useChatRealtime.js";
import { useConversationSearchSections } from "./composables/useConversationSearchSections.js";
import { useFriendCenter } from "./composables/useFriendCenter.js";
import { useListSearch } from "./composables/useListSearch.js";
import { formatConversationTime, useRecentKeywords } from "./composables/useRecentKeywords.js";
const shell = useDesktopShell();
const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const realtime = useChatRealtime(auth, store.selectedId, store.conversations, store.socketOnline, handleRealtimeEvent);
const friendCenter = useFriendCenter(store, {
  async onChanged() {
    await actions.loadContacts().catch(() => {});
    await actions.loadConversations().catch(() => {});
  },
});
const settingsOpen = ref(false);
const searchFocused = ref(false);
const quickCreateOpen = ref(false);
const appSettings = ref(loadAppSettings());
const appLogs = ref(readAppLogs());
const { recentKeywords, pushRecentKeyword, clearRecentKeywords } = useRecentKeywords();
const appInfo = ref({
  productName: "Linksee Chat",
  version: "",
  electron: window.desktopShell?.versions?.electron || "",
  chrome: window.desktopShell?.versions?.chrome || "",
  node: window.desktopShell?.versions?.node || "",
  storage: null,
});
const activePane = ref("messages");
const remarkDialogOpen = ref(false);
const remarkDraft = ref("");
const remarkTarget = ref(null);
const unreadTotal = computed(() => store.filteredConversations.value.reduce((sum, row) => {
  return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
}, 0));
const filteredFavorites = computed(() => {
  const keyword = store.conversationKeyword.value.trim().toLowerCase();
  return store.favoriteMessages.value.filter((item) => {
    if (!keyword) return true;
    return [item.conversationTitle, item.senderName, item.content]
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
});
const searchKeyword = computed(() => store.conversationKeyword.value.trim());
const contactRows = computed(() => store.createDialogContacts.value.map((contact) => ({
  key: `contact:${contact.id}`,
  id: contact.id,
  title: contact.name,
  subtitle: contact.friendAlias && contact.realName && contact.realName !== contact.friendAlias
    ? `${contact.realName}${contact.bio ? ` · ${contact.bio}` : ""}`
    : (contact.bio || "联系人"),
  meta: "联系人",
  kind: "contact",
  avatarUrl: contact.avatarUrl,
  avatarText: contact.name.slice(0, 2).toUpperCase(),
})));
const filteredContacts = computed(() => {
  const keyword = searchKeyword.value.toLowerCase();
  if (!keyword) return contactRows.value;
  return contactRows.value.filter((row) => (
    [row.title, row.subtitle].some((value) => String(value || "").toLowerCase().includes(keyword))
  ));
});
const searchPanelOpen = computed(() => searchFocused.value || Boolean(searchKeyword.value));
const visibleConversations = computed(() => (
  searchPanelOpen.value ? store.conversationRows.value : store.filteredConversations.value
));
const searchSections = useConversationSearchSections(store, searchKeyword, contactRows);
const searchController = useListSearch({
  openRef: searchPanelOpen,
  keywordRef: searchKeyword,
  recentKeywordsRef: recentKeywords,
  sectionsRef: searchSections,
  onPick: (item) => handleSearchPick(item),
  onRecentPick: (value) => applyRecentKeyword(value),
  onFooterPick: () => handleSearchFooterPick(),
});

let detachLogs = null;
let friendSearchTimer = 0;
const selectConversation = (id) => { store.selectedId.value = id; };

async function handleRealtimeEvent(event) {
  const topic = String(event?.topic || "");
  if (!topic || topic === "socket.ready") return;
  if (topic === "user.profile.updated") {
    const profile = event.payload?.profile || {};
    actions.applyUserProfileUpdate(event.payload?.userId, {
      realName: profile.realName,
      originalRealName: profile.originalRealName || profile.realName,
      bio: profile.bio || "",
      avatarUrl: profile.avatarUrl
        ? appendCacheBust(profile.avatarUrl, profile.avatarVersion || Date.now())
        : "",
    });
    return;
  }
  if (topic.startsWith("conversation.")) {
    actions.loadConversations().catch(() => {});
  }
}

async function openConversation(id) {
  store.showConversation(id);
  store.selectedId.value = id;
  if (typeof window.desktopShell?.openChatWindow === "function") await window.desktopShell.openChatWindow(id);
}
async function openFavorite(item) {
  if (!item?.conversationId) return;
  activePane.value = "messages";
  await openConversation(item.conversationId);
}

const removeFavorite = (item) => store.removeFavoriteMessage(item?.id);
const persistSettings = (nextSettings) => { appSettings.value = saveAppSettings(nextSettings); };
const handleAvatarUpload = (event) => actions.uploadAvatar(event.target?.files?.[0]).catch((error) => {
  store.profileHint.value = error?.message || "头像上传失败";
  store.profileHintTone.value = "error";
});
const copyConversationTitle = async (row) => {
  const title = String(row?.displayTitle || row?.title || "").trim();
  if (!title) return;
  try { await navigator.clipboard.writeText(title); store.pushNotification({ title: "已复制", message: `“${title}”`, tone: "success", ttl: 1600 }); }
  catch (error) { store.pushNotification({ title: "复制失败", message: error?.message || "当前环境不支持剪贴板", tone: "error" }); }
};
const toggleConversationMute = (row) => {
  const muted = store.toggleConversationMuted(row?.id);
  store.pushNotification({ title: muted ? "已开启免打扰" : "已取消免打扰", message: row?.displayTitle || "会话", tone: "success", ttl: 1600 });
};
const hideConversationFromList = (row) => {
  if (!row?.id) return;
  store.hideConversation(row.id);
  if (store.selectedId.value === row.id) store.selectedId.value = store.filteredConversations.value[0]?.id || "";
  store.pushNotification({ title: "已从列表隐藏", message: `${row.displayTitle || "会话"} 仍可通过搜索重新打开`, tone: "success", ttl: 2200 });
};
const openFriendRemark = (contact) => { remarkTarget.value = contact || null; remarkDraft.value = String(contact?.friendAlias || ""); remarkDialogOpen.value = true; };
async function submitFriendRemark() {
  if (!remarkTarget.value?.id) return;
  await friendCenter.updateAlias(remarkTarget.value.id, remarkDraft.value);
  await actions.loadContacts().catch(() => {});
  await actions.loadConversations().catch(() => {});
  remarkDialogOpen.value = false;
}

function handleGlobalPointer(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest(".qq-list-search-cluster") || target.closest(".qq-search-panel") || target.closest(".qq-plus-action-wrap") || target.closest(".qq-quick-create-menu") || target.closest(".new-friends-dialog-card")) return;
  searchFocused.value = false;
  quickCreateOpen.value = false;
}

const handleSearchInput = (value) => { store.conversationKeyword.value = value; searchFocused.value = true; };

function clearSearchInput() {
  store.conversationKeyword.value = "";
  searchFocused.value = true;
  searchController.resetActive();
}

function handleSearchPick(item) {
  pushRecentKeyword(searchKeyword.value || item.title);
  if (item.action === "conversation") {
    store.showConversation(item.id);
    selectConversation(item.id);
    openConversation(item.id);
  } else if (item.action === "contact") openDirectConversationByContact(item.id);
  else if (item.action === "favorite") openFavorite(item);
  searchFocused.value = false;
}

function handleSearchFooterPick() {
  const keyword = searchKeyword.value.trim();
  if (!keyword) {
    activePane.value = "messages";
    searchFocused.value = false;
    return;
  }

  const firstConversation = searchSections.value.find((section) => section.key === "conversations")?.items?.[0];
  const firstContact = searchSections.value.find((section) => section.key === "contacts")?.items?.[0];
  const firstFavorite = searchSections.value.find((section) => section.key === "favorites")?.items?.[0];

  if (firstConversation) {
    handleSearchPick(firstConversation);
    return;
  }
  if (firstContact) {
    handleSearchPick(firstContact);
    return;
  }
  if (firstFavorite) {
    handleSearchPick(firstFavorite);
    return;
  }

  activePane.value = "contacts";
  openNewFriendsCenter();
  friendCenter.keyword.value = keyword;
  friendCenter.refresh();
}

const applyRecentKeyword = (value) => {
  store.conversationKeyword.value = value;
  searchFocused.value = true;
};

function handleSearchKeydown(event) {
  if (!searchPanelOpen.value) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    searchController.move(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    searchController.move(-1);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    searchController.triggerActive();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    searchFocused.value = false;
    quickCreateOpen.value = false;
  }
}

const openDirectCreation = () => { quickCreateOpen.value = false; searchFocused.value = false; openNewFriendsCenter(); };
function openNewFriendsCenter() {
  quickCreateOpen.value = false;
  searchFocused.value = false;
  friendCenter.keyword.value = "";
  friendCenter.openCenter();
}

function openDirectConversationByContact(contactId) {
  actions.openOrCreateDirectConversation(contactId).catch((error) => {
    store.pushNotification({
      title: "无法打开会话",
      message: error?.message || "暂时无法打开这个联系人",
      tone: "error",
    });
  });
  activePane.value = "messages";
}

const startChatFromNewFriends = (contactId) => {
  activePane.value = "contacts";
  friendCenter.openDirectChat(contactId);
};
const openGroupCreation = () => {
  quickCreateOpen.value = false;
  searchFocused.value = false;
  actions.createGroupConversation();
};

onMounted(async () => {
  window.addEventListener("pointerdown", handleGlobalPointer);
  detachLogs = onAppLogsUpdated((logs) => {
    appLogs.value = logs;
  });
  const runtimeInfo = await window.desktopShell?.getAppInfo?.().catch(() => null);
  if (runtimeInfo) {
    appInfo.value = {
      productName: runtimeInfo.productName || "Linksee Chat",
      version: runtimeInfo.version || "",
      electron: runtimeInfo.electron || appInfo.value.electron,
      chrome: runtimeInfo.chrome || appInfo.value.chrome,
      node: runtimeInfo.node || appInfo.value.node,
      storage: runtimeInfo.storage || null,
    };
  }
  await actions.loadProfile(auth);
  await actions.loadContacts();
  await actions.loadConversations();
  await friendCenter.refresh();
  realtime.connect();
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleGlobalPointer);
  if (typeof detachLogs === "function") detachLogs();
  window.clearTimeout(friendSearchTimer);
  realtime.disconnect();
});

watch(searchKeyword, (value) => {
  if (value) quickCreateOpen.value = false;
});

watch(() => friendCenter.keyword.value, () => {
  window.clearTimeout(friendSearchTimer);
  friendSearchTimer = window.setTimeout(() => {
    if (friendCenter.open.value) friendCenter.refresh();
  }, 180);
});
</script>

<template>
  <main class="qq-list-shell">
    <aside class="qq-list-nav">
      <div class="qq-list-nav-top">
        <div class="qq-list-drag">
          <div class="qq-list-avatar">
            <AvatarImage :src="store.meAvatarUrl.value" alt="">
              <span>{{ store.meAvatar.value }}</span>
            </AvatarImage>
          </div>
        </div>

        <button class="qq-list-nav-btn" :class="{ 'is-active': activePane === 'messages' }" type="button" title="消息" @click="activePane = 'messages'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v7.17L8.4 15H19V7H5Z"/></svg>
          <i v-if="unreadTotal" class="qq-list-badge">{{ unreadTotal > 99 ? "99+" : unreadTotal }}</i>
        </button>
        <button class="qq-list-nav-btn" :class="{ 'is-active': activePane === 'contacts' }" type="button" title="联系人" @click="activePane = 'contacts'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>
        </button>
        <button class="qq-list-nav-btn" :class="{ 'is-active': activePane === 'favorites' }" type="button" title="收藏" @click="activePane = 'favorites'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 17.27 4.95 2.99-1.32-5.63L20 10.5l-5.76-.49L12 4.7l-2.24 5.31L4 10.5l4.37 4.13-1.32 5.63L12 17.27Z"/></svg>
        </button>
        <button class="qq-list-nav-btn" type="button" title="设置" @click="settingsOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.18 7.18 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.65 8.84a.5.5 0 0 0 .12.64L4.8 11.06c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.41 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/></svg>
        </button>
      </div>

      <div class="qq-list-nav-bottom">
        <button class="qq-list-nav-btn is-danger" type="button" title="退出" @click="logout">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17v-2h5V9h-5V7h7v10h-7Zm-1-1-5-4 5-4v3h5v2H9v3Z"/></svg>
        </button>
      </div>
    </aside>

    <section class="qq-list-panel">
      <section class="qq-list-overview">
        <header class="qq-list-topbar">
          <div class="qq-list-profile-copy">
            <div class="qq-list-profile-line">
              <strong>{{ store.meName.value }}</strong>
              <span class="qq-list-status-pill">在线</span>
              <span class="qq-list-status-pill is-muted">
                {{
                  activePane === "messages"
                    ? `${store.filteredConversations.value.length} 个会话`
                    : activePane === "contacts"
                      ? `${contactRows.length} 位联系人`
                      : `${filteredFavorites.length} 条收藏`
                }}
              </span>
            </div>
          </div>

          <div v-if="shell.isDesktop" class="qq-list-window-actions">
            <button class="compact-auth-window-btn compact-auth-window-btn-light" type="button" aria-label="最小化" @click="shell.minimizeWindow">─</button>
            <button class="compact-auth-window-btn compact-auth-window-btn-light is-close" type="button" aria-label="关闭" @click="shell.closeWindow">×</button>
          </div>
        </header>

        <div class="qq-list-search-row">
          <div class="qq-list-search-cluster">
            <label class="qq-list-search-box">
              <input
                :value="store.conversationKeyword.value"
                class="qq-list-search"
                :placeholder="activePane === 'messages' ? '搜索会话、联系人、消息' : activePane === 'contacts' ? '搜索联系人' : '搜索收藏消息'"
                @focus="searchFocused = true"
                @input="handleSearchInput($event.target.value)"
                @keydown="handleSearchKeydown"
              />
              <button
                v-if="store.conversationKeyword.value"
                class="qq-list-search-clear"
                type="button"
                aria-label="清空搜索"
                @click="clearSearchInput"
              >
                <svg viewBox="0 0 24 24"><path d="m12 10.59 4.95-4.95 1.41 1.41L13.41 12l4.95 4.95-1.41 1.41L12 13.41l-4.95 4.95-1.41-1.41L10.59 12 5.64 7.05l1.41-1.41L12 10.59Z"/></svg>
              </button>
              <span class="qq-list-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm8.91 11.5 2.8 2.79-1.42 1.42-2.79-2.8 1.41-1.41Z"/></svg>
              </span>
            </label>

            <div class="qq-plus-action-wrap">
              <button class="qq-plus-action-btn" type="button" title="添加好友或创建群聊" @click="quickCreateOpen = !quickCreateOpen">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>
                <i v-if="friendCenter.requestTotal.value" class="qq-plus-action-badge">
                  {{ friendCenter.requestTotal.value > 9 ? "9+" : friendCenter.requestTotal.value }}
                </i>
              </button>
              <QuickCreateMenu :open="quickCreateOpen" @direct="openDirectCreation" @group="openGroupCreation" />
            </div>
          </div>

          <ListSearchPanel
            :open="searchPanelOpen"
            :keyword="searchKeyword"
            :recent-keywords="recentKeywords"
            :sections="searchSections"
            :active-key="searchController.activeKey.value"
            @pick="handleSearchPick"
            @clear-recent="clearRecentKeywords"
            @recent-pick="applyRecentKeyword"
            @footer-pick="handleSearchFooterPick"
          />
        </div>
      </section>

      <div class="qq-list-conversations-shell">
        <ConversationThreadList
          v-if="activePane === 'messages'"
          :rows="visibleConversations"
          :selected-id="store.selectedId.value"
          :format-time="formatConversationTime"
          :desktop="shell.isDesktop"
          @select="selectConversation"
          @open="openConversation"
          @toggle-pin="actions.toggleConversationPinById($event.id)"
          @toggle-mute="toggleConversationMute"
          @hide-conversation="hideConversationFromList"
          @copy-title="copyConversationTitle"
        />

        <ContactDirectoryPanel
          v-else-if="activePane === 'contacts'"
          :contacts="filteredContacts"
          :request-total="friendCenter.requestTotal.value"
          @new-friends="openNewFriendsCenter"
          @open-contact="openDirectConversationByContact"
        />

        <div v-else class="qq-thread-list">
          <div v-if="!filteredFavorites.length" class="empty-state">暂无收藏消息</div>
          <article
            v-for="item in filteredFavorites"
            :key="`${item.id}:${item.conversationId}`"
            class="qq-thread-item is-favorite"
            @dblclick="openFavorite(item)"
          >
            <div class="qq-thread-avatar is-favorite">
              <span>★</span>
            </div>

            <div class="qq-thread-copy">
              <div class="qq-thread-head">
                <strong>{{ item.conversationTitle }}</strong>
                <div class="qq-thread-favorite-meta">
                  <span class="qq-thread-time">{{ formatConversationTime(item.createdAt) }}</span>
                  <button class="qq-thread-favorite-remove" type="button" @click.stop="removeFavorite(item)">移除</button>
                </div>
              </div>
              <p class="qq-thread-subtitle">{{ item.senderName }}</p>
              <div class="qq-thread-preview-row">
                <p class="qq-thread-preview">{{ item.content }}</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <CreateConversationDialog
      :open="store.createDialogOpen.value"
      :mode="store.createDialogMode.value"
      :title="store.createDialogTitle.value"
      :peer-id="store.selectedPeerId.value"
      :participant-ids="store.createDialogParticipantIds.value"
      :contacts="store.createDialogContacts.value"
      :selected-participants="store.selectedParticipants.value"
      :hint="store.createDialogHint.value"
      :hint-tone="store.createDialogHintTone.value"
      :submitting="store.createDialogSubmitting.value"
      @close="store.closeCreateDialog"
      @submit="actions.submitCreateConversation"
      @update:title="store.createDialogTitle.value = $event"
      @update:peer-id="store.createDialogPeerId.value = $event"
      @toggle-participant="store.toggleDialogParticipant"
    />

    <NewFriendsDialog
      :open="friendCenter.open.value"
      :keyword="friendCenter.keyword.value"
      :loading="friendCenter.loading.value"
      :hint="friendCenter.hint.value"
      :hint-tone="friendCenter.hintTone.value"
      :recent-contacts="friendCenter.recentContacts.value"
      :incoming-requests="friendCenter.incomingRequests.value"
      :outgoing-requests="friendCenter.outgoingRequests.value"
      :recommended-users="friendCenter.recommendedUsers.value"
      :friend-contacts="friendCenter.friendContacts.value"
      @close="friendCenter.closeCenter()"
      @update:keyword="friendCenter.keyword.value = $event"
      @start-chat="startChatFromNewFriends"
      @edit-friend="openFriendRemark"
      @send-request="friendCenter.sendRequest"
      @accept-request="friendCenter.resolveRequest($event, 'accept', '已通过好友申请')"
      @reject-request="friendCenter.resolveRequest($event, 'reject', '已拒绝好友申请')"
      @cancel-request="friendCenter.resolveRequest($event, 'cancel', '已取消好友申请')"
    />

    <FriendRemarkDialog
      :open="remarkDialogOpen"
      :contact="remarkTarget"
      :value="remarkDraft"
      @close="remarkDialogOpen = false"
      @update:value="remarkDraft = $event"
      @submit="submitFriendRemark"
    />

    <SettingsDialog
      :open="settingsOpen"
      :settings="appSettings"
      :profile-name="store.profileName.value"
      :profile-bio="store.profileBio.value"
      :profile-hint="store.profileHint.value"
      :profile-hint-tone="store.profileHintTone.value"
      :me-avatar-url="store.meAvatarUrl.value"
      :app-info="appInfo"
      :logs="appLogs"
      @close="settingsOpen = false"
      @clear-logs="clearAppLogs()"
      @update:settings="persistSettings"
      @update:profile-name="store.profileName.value = $event"
      @update:profile-bio="store.profileBio.value = $event"
      @save-profile="actions.saveProfile"
      @upload-avatar="handleAvatarUpload"
    />
  </main>
</template>

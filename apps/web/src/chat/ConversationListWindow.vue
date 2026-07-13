<script setup>
import AvatarImage from "../shared/components/AvatarImage.vue";
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { getAuth, logout } from "../shared/session.js";
import ContactDirectoryPanel from "./components/ContactDirectoryPanel.vue";
import ConversationListDialogs from "./components/ConversationListDialogs.vue";
import ConversationThreadList from "./components/ConversationThreadList.vue";
import ListSearchPanel from "./components/ListSearchPanel.vue";
import QuickCreateMenu from "./components/QuickCreateMenu.vue";
import { useChatActions } from "./composables/useChatActions.js";
import { useChatRealtime } from "./composables/useChatRealtime.js";
import { useConversationListRuntime } from "./composables/useConversationListRuntime.js";
import { useFriendCenter } from "./composables/useFriendCenter.js";
import { usePasswordChange } from "./composables/usePasswordChange.js";
import { useChatStore } from "./store/useChatStore.js";

const shell = useDesktopShell();
const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const passwordChange = usePasswordChange();
let runtime = null;
const realtime = useChatRealtime(
  auth,
  store.selectedId,
  store.conversations,
  store.socketOnline,
  (event) => runtime?.handleRealtimeEvent?.(event),
);
const friendCenter = useFriendCenter(store, {
  async onChanged() {
    await actions.loadContacts().catch(() => {});
    await actions.loadConversations().catch(() => {});
  },
});
const selectConversation = (id) => {
  store.selectedId.value = id;
};

runtime = useConversationListRuntime({
  auth,
  store,
  actions,
  realtime,
  shell,
  friendCenter,
  selectConversation,
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

        <button class="qq-list-nav-btn" :class="{ 'is-active': runtime.activePane.value === 'messages' }" type="button" title="消息" @click="runtime.activePane.value = 'messages'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v7.17L8.4 15H19V7H5Z"/></svg>
          <i v-if="runtime.unreadTotal.value" class="qq-list-badge">{{ runtime.unreadTotal.value > 99 ? "99+" : runtime.unreadTotal.value }}</i>
        </button>
        <button class="qq-list-nav-btn" :class="{ 'is-active': runtime.activePane.value === 'contacts' }" type="button" title="联系人" @click="runtime.activePane.value = 'contacts'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>
        </button>
        <button class="qq-list-nav-btn" :class="{ 'is-active': runtime.activePane.value === 'favorites' }" type="button" title="收藏" @click="runtime.activePane.value = 'favorites'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 17.27 4.95 2.99-1.32-5.63L20 10.5l-5.76-.49L12 4.7l-2.24 5.31L4 10.5l4.37 4.13-1.32 5.63L12 17.27Z"/></svg>
        </button>
        <button class="qq-list-nav-btn" type="button" title="设置" @click="runtime.openSettings">
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
                  runtime.activePane.value === "messages"
                    ? `${store.filteredConversations.value.length} 个会话`
                    : runtime.activePane.value === "contacts"
                      ? `${runtime.contactRows.value.length} 位联系人`
                      : `${runtime.filteredFavorites.value.length} 条收藏`
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
                :placeholder="runtime.activePane.value === 'messages' ? '搜索会话、联系人、消息' : runtime.activePane.value === 'contacts' ? '搜索联系人' : '搜索收藏消息'"
                @focus="runtime.searchFocused.value = true"
                @input="runtime.handleSearchInput($event.target.value)"
                @keydown="runtime.handleSearchKeydown"
              />
              <button
                v-if="store.conversationKeyword.value"
                class="qq-list-search-clear"
                type="button"
                aria-label="清空搜索"
                @click="runtime.clearSearchInput"
              >
                <svg viewBox="0 0 24 24"><path d="m12 10.59 4.95-4.95 1.41 1.41L13.41 12l4.95 4.95-1.41 1.41L12 13.41l-4.95 4.95-1.41-1.41L10.59 12 5.64 7.05l1.41-1.41L12 10.59Z"/></svg>
              </button>
              <span class="qq-list-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm8.91 11.5 2.8 2.79-1.42 1.42-2.79-2.8 1.41-1.41Z"/></svg>
              </span>
            </label>

            <div class="qq-plus-action-wrap">
              <button class="qq-plus-action-btn" type="button" title="添加好友或创建群聊" @click="runtime.quickCreateOpen.value = !runtime.quickCreateOpen.value">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>
                <i v-if="friendCenter.requestTotal.value" class="qq-plus-action-badge">
                  {{ friendCenter.requestTotal.value > 9 ? "9+" : friendCenter.requestTotal.value }}
                </i>
              </button>
              <QuickCreateMenu :open="runtime.quickCreateOpen.value" @direct="runtime.openDirectCreation" @group="runtime.openGroupCreation" />
            </div>
          </div>

          <ListSearchPanel
            :open="runtime.searchPanelOpen.value"
            :keyword="runtime.searchKeyword.value"
            :recent-keywords="runtime.recentKeywords"
            :sections="runtime.searchSections"
            :active-key="runtime.searchActiveKey.value"
            @pick="runtime.handleSearchPick"
            @clear-recent="runtime.clearRecentKeywords"
            @recent-pick="store.conversationKeyword.value = $event; runtime.searchFocused.value = true"
            @footer-pick="runtime.handleSearchFooterPick"
          />
        </div>
      </section>

      <div class="qq-list-conversations-shell">
        <ConversationThreadList
          v-if="runtime.activePane.value === 'messages'"
          :rows="runtime.visibleConversations.value"
          :selected-id="store.selectedId.value"
          :format-time="runtime.formatConversationTime"
          :desktop="shell.isDesktop"
          :keyword="runtime.searchKeyword.value"
          :load-state="store.conversationLoadState.value"
          @select="runtime.selectConversation"
          @open="runtime.openConversation"
          @toggle-pin="actions.toggleConversationPinById($event.id)"
          @mark-read="runtime.markConversationRead"
          @toggle-mute="runtime.toggleConversationMute"
          @hide-conversation="runtime.hideConversationFromList"
          @copy-title="runtime.copyConversationTitle"
          @retry-load="runtime.reloadConversationList"
        />

        <ContactDirectoryPanel
          v-else-if="runtime.activePane.value === 'contacts'"
          :contacts="runtime.filteredContacts.value"
          :request-total="friendCenter.requestTotal.value"
          :keyword="runtime.searchKeyword.value"
          @new-friends="runtime.openNewFriendsCenter"
          @open-contact="runtime.openDirectConversationByContact"
        />

        <div v-else class="qq-thread-list">
          <div v-if="!runtime.filteredFavorites.value.length" class="empty-state">暂无收藏消息</div>
          <article
            v-for="item in runtime.filteredFavorites.value"
            :key="`${item.id}:${item.conversationId}`"
            class="qq-thread-item is-favorite"
            @dblclick="runtime.openFavorite(item)"
          >
            <div class="qq-thread-avatar is-favorite">
              <span>★</span>
            </div>

            <div class="qq-thread-copy">
              <div class="qq-thread-head">
                <strong>{{ item.conversationTitle }}</strong>
                <div class="qq-thread-favorite-meta">
                  <span class="qq-thread-time">{{ runtime.formatConversationTime(item.createdAt) }}</span>
                  <button class="qq-thread-favorite-remove" type="button" @click.stop="runtime.removeFavorite(item)">移除</button>
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

    <ConversationListDialogs
      :store="store"
      :actions="actions"
      :friend-center="friendCenter"
      :password-change="passwordChange"
      :auth="auth"
      :app-settings="runtime.appSettings.value"
      :desktop-preferences="runtime.desktopPreferences.value"
      :app-info="runtime.appInfo.value"
      :settings-open="runtime.settingsOpen.value"
      :remark-dialog-open="runtime.remarkDialogOpen.value"
      :remark-draft="runtime.remarkDraft.value"
      :remark-target="runtime.remarkTarget.value"
      :update-prompt-open="runtime.updatePromptOpen.value"
      @close-settings="runtime.closeSettings"
      @update:settings="runtime.persistSettings"
      @update:desktop-preferences="runtime.persistDesktopPreferences"
      @update:profile-name="store.profileName.value = $event"
      @update:profile-bio="store.profileBio.value = $event"
      @save-profile="actions.saveProfile"
      @submit-password="passwordChange.submitPassword"
      @logout="logout"
      @upload-avatar="runtime.handleAvatarUpload"
      @choose-download-dir="runtime.chooseDownloadDirectory"
      @open-download-dir="runtime.openDownloadDirectory"
      @clear-cache="runtime.clearDesktopCache"
      @open-update="runtime.handleUpdateNow"
      @close-update="runtime.closeUpdatePrompt"
      @update-now="runtime.handleUpdateNow"
      @remind-later="runtime.remindUpdateLater"
      @close-remark="runtime.closeFriendRemark"
      @update:remark-draft="runtime.remarkDraft.value = $event"
      @submit-remark="runtime.submitFriendRemark"
      @start-chat="runtime.startChatFromNewFriends"
      @edit-friend="runtime.openFriendRemark"
    />
  </main>
</template>

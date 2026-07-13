<script setup>
import ContactDirectoryPanel from "./ContactDirectoryPanel.vue";
import ConversationListNav from "./ConversationListNav.vue";
import ConversationListOverview from "./ConversationListOverview.vue";
import ConversationThreadList from "./ConversationThreadList.vue";
import FavoriteMessageList from "./FavoriteMessageList.vue";

defineProps({
  actions: { type: Object, required: true },
  friendCenter: { type: Object, required: true },
  runtime: { type: Object, required: true },
  shell: { type: Object, required: true },
  store: { type: Object, required: true },
});

defineEmits(["logout"]);
</script>

<template>
  <ConversationListNav
    :active-pane="runtime.activePane.value"
    :me-avatar="store.meAvatar.value"
    :me-avatar-url="store.meAvatarUrl.value"
    :unread-total="runtime.unreadTotal.value"
    @update:pane="runtime.activePane.value = $event"
    @open-settings="runtime.openSettings"
    @logout="$emit('logout')"
  />

  <section class="qq-list-panel">
    <ConversationListOverview
      :active-pane="runtime.activePane.value"
      :contact-count="runtime.contactRows.value.length"
      :conversation-count="store.filteredConversations.value.length"
      :favorite-count="runtime.filteredFavorites.value.length"
      :friend-request-total="friendCenter.requestTotal.value"
      :keyword="store.conversationKeyword.value"
      :me-name="store.meName.value"
      :quick-create-open="runtime.quickCreateOpen.value"
      :recent-keywords="runtime.recentKeywords"
      :search-active-key="runtime.searchActiveKey.value"
      :search-focused="runtime.searchFocused.value"
      :search-keyword="runtime.searchKeyword.value"
      :search-panel-open="runtime.searchPanelOpen.value"
      :search-sections="runtime.searchSections"
      :shell="shell"
      @update:keyword="runtime.handleSearchInput($event)"
      @focus-search="runtime.searchFocused.value = true"
      @search-keydown="runtime.handleSearchKeydown"
      @clear-search="runtime.clearSearchInput"
      @toggle-quick-create="runtime.quickCreateOpen.value = !runtime.quickCreateOpen.value"
      @open-direct="runtime.openDirectCreation"
      @open-group="runtime.openGroupCreation"
      @search-pick="runtime.handleSearchPick"
      @clear-recent="runtime.clearRecentKeywords"
      @recent-pick="store.conversationKeyword.value = $event; runtime.searchFocused.value = true"
      @search-footer-pick="runtime.handleSearchFooterPick"
    />

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

      <FavoriteMessageList
        v-else
        :favorites="runtime.filteredFavorites.value"
        :format-time="runtime.formatConversationTime"
        @open-favorite="runtime.openFavorite"
        @remove-favorite="runtime.removeFavorite"
      />
    </div>
  </section>
</template>

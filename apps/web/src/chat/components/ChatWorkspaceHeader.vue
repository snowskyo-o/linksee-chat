<script setup>
import { computed } from "vue";
import ChatStandaloneTopbar from "./ChatStandaloneTopbar.vue";
import ChatWorkspaceSearchBar from "./ChatWorkspaceSearchBar.vue";

const props = defineProps({
  chatTitle: { type: String, default: "请选择会话" },
  chatKind: { type: String, default: "" },
  participantCount: { type: Number, default: 0 },
  standaloneMode: { type: Boolean, default: false },
  networkBannerText: { type: String, default: "" },
  messageKeyword: { type: String, default: "" },
  searching: { type: Boolean, default: false },
  searchResultText: { type: String, default: "" },
  searchMatchIndex: { type: Number, default: -1 },
  searchMatchesLength: { type: Number, default: 0 },
});

defineEmits(["update:messageKeyword", "search", "clear-search", "search-prev", "search-next"]);

const displayChatTitle = computed(() => {
  if (props.chatKind !== "group") return props.chatTitle;
  const count = Number(props.participantCount || 0);
  return count > 0 ? `${props.chatTitle}（${count}）` : props.chatTitle;
});
</script>

<template>
  <ChatStandaloneTopbar v-if="standaloneMode" />

  <header class="chat-workspace-head" :class="{ 'is-standalone': standaloneMode }">
    <div class="chat-title-block">
      <h2>{{ displayChatTitle }}</h2>
    </div>
  </header>

  <div v-if="networkBannerText" class="chat-network-banner">
    <span class="chat-network-banner__dot" aria-hidden="true"></span>
    <span>{{ networkBannerText }}</span>
  </div>

  <ChatWorkspaceSearchBar
    :message-keyword="messageKeyword"
    :searching="searching"
    :search-result-text="searchResultText"
    :search-match-index="searchMatchIndex"
    :search-matches-length="searchMatchesLength"
    @update:message-keyword="$emit('update:messageKeyword', $event)"
    @search="$emit('search')"
    @clear-search="$emit('clear-search')"
    @search-prev="$emit('search-prev')"
    @search-next="$emit('search-next')"
  />
</template>

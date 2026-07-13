<script setup>
defineProps({
  messageKeyword: { type: String, default: "" },
  searchMatchIndex: { type: Number, default: -1 },
  searchMatchesLength: { type: Number, default: 0 },
  searchResultText: { type: String, default: "" },
  searching: { type: Boolean, default: false },
});

defineEmits(["update:messageKeyword", "search", "clear-search", "search-prev", "search-next"]);
</script>

<template>
  <div class="chat-toolbar-search">
    <div class="chat-toolbar-search-inner">
      <input
        :value="messageKeyword"
        class="qq-search qq-search-inline is-chat"
        placeholder="搜索消息"
        @input="$emit('update:messageKeyword', $event.target.value)"
        @keydown.enter.prevent="$emit('search')"
      />
      <button v-if="messageKeyword || searching" class="ghost-btn compact-btn" type="button" @click="$emit('clear-search')">
        清除
      </button>
    </div>
  </div>

  <div v-if="searchResultText" class="search-bar">{{ searchResultText }}</div>
  <div v-if="searching && searchMatchesLength" class="search-bar search-nav-bar">
    <span>当前匹配 {{ searchMatchIndex + 1 }} / {{ searchMatchesLength }}</span>
    <div class="search-nav-actions">
      <button class="ghost-btn compact-btn" type="button" @click="$emit('search-prev')">上一条</button>
      <button class="ghost-btn compact-btn" type="button" @click="$emit('search-next')">下一条</button>
    </div>
  </div>
</template>

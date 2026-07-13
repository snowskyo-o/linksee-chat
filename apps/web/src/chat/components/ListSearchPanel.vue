<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  open: { type: Boolean, default: false },
  keyword: { type: String, default: "" },
  recentKeywords: { type: Array, default: () => [] },
  sections: { type: Array, default: () => [] },
  activeKey: { type: String, default: "" },
});

defineEmits(["pick", "clear-recent", "recent-pick", "footer-pick"]);
</script>

<template>
  <div v-if="open" class="qq-search-panel">
    <div class="qq-search-overview">
      <div class="qq-search-overview-copy">
        <strong>{{ keyword ? "搜索结果" : "快速搜索" }}</strong>
        <small>{{ keyword ? `回车打开首项，Esc 关闭` : "可以查找会话、联系人、收藏消息" }}</small>
      </div>
      <span v-if="keyword" class="qq-search-overview-tag">
        {{ sections.reduce((sum, section) => sum + section.items.length, 0) }} 条结果
      </span>
    </div>

    <div v-if="!keyword && recentKeywords.length" class="qq-search-section">
      <div class="qq-search-section-head">
        <strong>最近搜索</strong>
        <button class="qq-search-clear-btn" type="button" @click="$emit('clear-recent')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h5v2H3V5h5l1-2Zm1 7h2v8h-2v-8Zm4 0h2v8h-2v-8ZM7 10h2v8H7v-8Z"/></svg>
        </button>
      </div>
      <div class="qq-search-recent-list">
        <button
          v-for="item in recentKeywords"
          :key="item"
          class="qq-search-recent-item"
          :class="{ 'is-active': activeKey === `recent:${item}` }"
          type="button"
          @click="$emit('recent-pick', item)"
        >
          <span class="qq-search-item-avatar is-recent" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 5a7 7 0 1 1-7 7H3l3.2 3.2 1.4-1.4L6.8 13H7a5 5 0 1 0 5-5V5Z"/></svg>
          </span>
          <span class="qq-search-item-copy">
            <strong>{{ item }}</strong>
            <small>再次搜索</small>
          </span>
        </button>
      </div>
    </div>

    <template v-for="section in sections" :key="section.key">
      <div v-if="section.items.length" class="qq-search-section">
        <div class="qq-search-section-head">
          <strong>{{ section.title }}</strong>
          <span>{{ section.items.length }}</span>
        </div>
        <div class="qq-search-result-list">
          <button
            v-for="item in section.items"
            :key="item.key"
            class="qq-search-result-item"
            :class="{ 'is-active': activeKey === item.key }"
            type="button"
            @click="$emit('pick', item)"
          >
            <span class="qq-search-item-avatar" :class="`is-${item.kind}`">
              <AvatarImage v-if="item.avatarUrl" :src="item.avatarUrl" alt="">
                <span>{{ item.avatarText }}</span>
              </AvatarImage>
              <template v-else>{{ item.avatarText }}</template>
            </span>
            <span class="qq-search-item-copy">
              <strong>{{ item.title }}</strong>
              <small>{{ item.subtitle }}</small>
            </span>
            <span v-if="item.meta" class="qq-search-item-meta">{{ item.meta }}</span>
          </button>
        </div>
      </div>
    </template>

    <div v-if="keyword && sections.every((section) => !section.items.length)" class="qq-search-empty">
      <strong>没有找到相关内容</strong>
      <p>可以尝试搜索联系人、会话名称或消息片段。</p>
    </div>

    <button class="qq-search-footer" :class="{ 'is-active': activeKey === 'footer:entry' }" type="button" @click="$emit('footer-pick')">
      <span class="qq-search-item-avatar is-entry" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm8.91 11.5 2.8 2.79-1.42 1.42-2.79-2.8 1.41-1.41Z"/></svg>
      </span>
      <span class="qq-search-item-copy">
        <strong>综合搜索</strong>
        <small>{{ keyword ? `继续查找“${keyword}”` : "查找用户、群聊和消息" }}</small>
      </span>
      <span class="qq-search-item-meta">Enter</span>
    </button>
  </div>
</template>

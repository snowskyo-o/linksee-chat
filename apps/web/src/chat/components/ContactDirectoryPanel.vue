<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  contacts: { type: Array, default: () => [] },
  requestTotal: { type: Number, default: 0 },
  keyword: { type: String, default: "" },
});

defineEmits(["open-contact", "new-friends"]);
</script>

<template>
  <div class="qq-contact-panel">
    <button class="qq-contact-entry-card" type="button" @click="$emit('new-friends')">
      <span class="qq-contact-entry-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 5a4 4 0 1 0 0 8a4 4 0 0 0 0-8Zm-7 13c0-2.76 3.13-5 7-5 1.22 0 2.37.22 3.37.6a6.48 6.48 0 0 0-.94 1.77A8.73 8.73 0 0 0 12 15c-2.6 0-4.73 1.12-5 2.5V18h7.08c.11.72.37 1.4.76 2H5v-2Zm12.5-5v2.5H20v1.5h-2.5V20H16v-2.5h-2.5V16H16v-2.5h1.5Z"/></svg>
      </span>
      <span class="qq-contact-entry-copy">
        <strong>新朋友</strong>
        <small>{{ requestTotal ? `有 ${requestTotal} 条待处理申请` : "添加好友、发起新的私聊会话" }}</small>
      </span>
    </button>

    <div class="qq-contact-section">
      <div class="qq-contact-section-head">
        <strong>联系人</strong>
        <span>{{ contacts.length }}</span>
      </div>

      <div v-if="!contacts.length" class="qq-contact-empty">
        <strong>{{ keyword ? "没有匹配的联系人" : "暂无联系人" }}</strong>
        <p>{{ keyword ? "试试更换搜索词，或者先添加新的联系人。" : "添加一个联系人，就可以从这里快速开始聊天。" }}</p>
        <button class="primary-btn compact-btn" type="button" @click="$emit('new-friends')">
          {{ keyword ? "添加联系人" : "去添加联系人" }}
        </button>
      </div>

      <div v-else class="qq-contact-list">
        <button
          v-for="contact in contacts"
          :key="contact.id"
          class="qq-contact-item"
          type="button"
          @click="$emit('open-contact', contact.id)"
        >
          <span class="qq-contact-avatar">
            <AvatarImage :src="contact.avatarUrl" alt="">
              <span>{{ contact.name.slice(0, 2).toUpperCase() }}</span>
            </AvatarImage>
          </span>
          <span class="qq-contact-copy">
            <strong>{{ contact.name }}</strong>
            <small>{{ contact.bio || "联系人" }}</small>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  activePane: { type: String, default: "messages" },
  meAvatar: { type: String, default: "ME" },
  meAvatarUrl: { type: String, default: "" },
  unreadTotal: { type: Number, default: 0 },
});

defineEmits(["update:pane", "open-settings", "logout"]);
</script>

<template>
  <aside class="qq-list-nav">
    <div class="qq-list-nav-top">
      <div class="qq-list-drag">
        <div class="qq-list-avatar">
          <AvatarImage :src="meAvatarUrl" alt="">
            <span>{{ meAvatar }}</span>
          </AvatarImage>
        </div>
      </div>

      <button class="qq-list-nav-btn" :class="{ 'is-active': activePane === 'messages' }" type="button" title="消息" @click="$emit('update:pane', 'messages')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v7.17L8.4 15H19V7H5Z"/></svg>
        <i v-if="unreadTotal" class="qq-list-badge">{{ unreadTotal > 99 ? "99+" : unreadTotal }}</i>
      </button>
      <button class="qq-list-nav-btn" :class="{ 'is-active': activePane === 'contacts' }" type="button" title="联系人" @click="$emit('update:pane', 'contacts')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>
      </button>
      <button class="qq-list-nav-btn" :class="{ 'is-active': activePane === 'favorites' }" type="button" title="收藏" @click="$emit('update:pane', 'favorites')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 17.27 4.95 2.99-1.32-5.63L20 10.5l-5.76-.49L12 4.7l-2.24 5.31L4 10.5l4.37 4.13-1.32 5.63L12 17.27Z"/></svg>
      </button>
      <button class="qq-list-nav-btn" type="button" title="设置" @click="$emit('open-settings')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.18 7.18 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.65 8.84a.5.5 0 0 0 .12.64L4.8 11.06c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.41 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/></svg>
      </button>
    </div>

    <div class="qq-list-nav-bottom">
      <button class="qq-list-nav-btn is-danger" type="button" title="退出" @click="$emit('logout')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17v-2h5V9h-5V7h7v10h-7Zm-1-1-5-4 5-4v3h5v2H9v3Z"/></svg>
      </button>
    </div>
  </aside>
</template>

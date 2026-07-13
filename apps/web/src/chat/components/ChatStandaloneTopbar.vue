<script setup>
import { computed } from "vue";
import { useDesktopShell } from "../../shared/useDesktopShell.js";

const props = defineProps({
  hasConversation: { type: Boolean, default: false },
  title: { type: String, default: "" },
});

const shell = useDesktopShell();
const titleText = computed(() => (
  props.hasConversation && props.title ? props.title : "Linksee Chat"
));
</script>

<template>
  <div class="chat-standalone-topbar">
    <div class="chat-window-drag">
      <span class="chat-window-mark">L</span>
      <span class="chat-window-app">{{ titleText }}</span>
    </div>
    <div v-if="shell.isDesktop" class="chat-window-actions">
      <button class="desktop-window-btn desktop-window-btn-standalone" type="button" aria-label="最小化" @click="shell.minimizeWindow">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.75h8v1.5H2z"/></svg>
      </button>
      <button class="desktop-window-btn desktop-window-btn-standalone" type="button" aria-label="最大化" @click="shell.toggleMaximizeWindow">
        <svg v-if="shell.isMaximized" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 1.5h6v6H7.5V9h-6V3h1.5V1.5Zm0 3h3v3H3v-3Zm1.5-1.5V3h4.5v4.5H9V3h-4.5Z"/>
        </svg>
        <svg v-else viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 2h8v8H2V2Zm1.5 1.5v5h5v-5h-5Z"/>
        </svg>
      </button>
      <button class="desktop-window-btn desktop-window-btn-standalone is-close" type="button" aria-label="关闭" @click="shell.closeWindow">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3.06 2 2.94 2.94L8.94 2 10 3.06 7.06 6 10 8.94 8.94 10 6 7.06 3.06 10 2 8.94 4.94 6 2 3.06 3.06 2Z"/></svg>
      </button>
    </div>
  </div>
</template>

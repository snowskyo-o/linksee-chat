<script setup>
import { computed } from "vue";
import { useDesktopShell } from "../useDesktopShell.js";

const props = defineProps({
  appTitle: { type: String, default: "Linksee Chat" },
  viewTitle: { type: String, default: "" },
  viewMeta: { type: String, default: "" },
});

const shell = useDesktopShell();
const titleText = computed(() => props.viewTitle || props.appTitle);
const metaText = computed(() => props.viewMeta || "桌面客户端");
</script>

<template>
  <header class="desktop-titlebar" :class="{ 'is-desktop': shell.isDesktop, 'is-maximized': shell.isMaximized }">
    <div class="desktop-titlebar-drag">
      <div class="desktop-app-mark">L</div>
      <div class="desktop-title-copy">
        <strong>{{ titleText }}</strong>
        <span>{{ metaText }}</span>
      </div>
    </div>

    <div v-if="shell.isDesktop" class="desktop-window-actions">
      <button class="desktop-window-btn" type="button" aria-label="最小化" @click="shell.minimizeWindow">-</button>
      <button class="desktop-window-btn" type="button" aria-label="最大化" @click="shell.toggleMaximizeWindow">
        {{ shell.isMaximized ? "❐" : "□" }}
      </button>
      <button class="desktop-window-btn is-close" type="button" aria-label="关闭" @click="shell.closeWindow">×</button>
    </div>
  </header>
</template>

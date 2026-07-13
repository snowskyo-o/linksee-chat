<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  src: { type: String, default: "" },
  alt: { type: String, default: "" },
});

const broken = ref(false);
const resolvedSrc = ref("");

watch(() => props.src, async (nextSrc) => {
  broken.value = false;
  resolvedSrc.value = String(nextSrc || "");
  if (!resolvedSrc.value || !window.desktopShell?.isDesktop || typeof window.desktopShell?.resolveAvatarSource !== "function") return;
  try {
    resolvedSrc.value = await window.desktopShell.resolveAvatarSource(resolvedSrc.value);
  } catch {
    resolvedSrc.value = String(nextSrc || "");
  }
}, { immediate: true });
</script>

<template>
  <img v-if="resolvedSrc && !broken" :src="resolvedSrc" :alt="alt" @error="broken = true" />
  <slot v-else></slot>
</template>

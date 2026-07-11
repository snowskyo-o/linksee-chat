<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  src: { type: String, default: "" },
  alt: { type: String, default: "" },
});

const broken = ref(false);

watch(() => props.src, () => {
  broken.value = false;
});
</script>

<template>
  <img v-if="src && !broken" :src="src" :alt="alt" @error="broken = true" />
  <slot v-else></slot>
</template>

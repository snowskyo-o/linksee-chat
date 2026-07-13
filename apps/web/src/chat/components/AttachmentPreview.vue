<script setup>
defineProps({
  files: { type: Array, default: () => [] },
});

defineEmits(["remove"]);
</script>

<template>
  <div v-if="files.length" class="composer-attachment-tray">
    <div v-for="file in files" :key="file.id" class="composer-attachment-card" :class="{ 'is-image': file.isImage }">
      <img v-if="file.isImage && file.previewUrl" :src="file.previewUrl" :alt="file.name" class="composer-attachment-image" />
      <div v-else class="composer-file-icon">
        <span>{{ file.extensionLabel }}</span>
      </div>
      <div class="composer-attachment-copy">
        <strong>{{ file.name }}</strong>
        <small>{{ file.sizeText }}</small>
      </div>
      <button class="composer-attachment-remove" type="button" title="移除" @click="$emit('remove', file.id)">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4.2 3.1 3.8 3.8 3.8-3.8 1.1 1.1L9.1 8l3.8 3.8-1.1 1.1L8 9.1l-3.8 3.8-1.1-1.1L6.9 8 3.1 4.2l1.1-1.1Z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

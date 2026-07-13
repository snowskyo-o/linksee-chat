<script setup>
import ImageViewerDialog from "./ImageViewerDialog.vue";
import StickerImportDialog from "./StickerImportDialog.vue";

defineProps({
  appInfo: { type: Object, default: () => ({}) },
  imageViewerActiveFile: { type: Object, default: null },
  imageViewerHint: { type: String, default: "" },
  imageViewerLoading: { type: Boolean, default: false },
  imageViewerOpen: { type: Boolean, default: false },
  imageViewerOwnerMessageId: { type: String, default: "" },
  imageViewerSrc: { type: String, default: "" },
  imageViewerStatusText: { type: String, default: "" },
  imageViewerTitle: { type: String, default: "" },
  stickerImportOpen: { type: Boolean, default: false },
  stickerLibrary: { type: Object, default: () => ({}) },
});

defineEmits([
  "close-image-viewer", "close-sticker-import", "copy-image", "delete-sticker", "download-image",
  "forward-image", "import-sticker-files", "import-sticker-folder", "move-sticker", "open-image-location",
  "open-sticker-folder", "rename-sticker",
]);
</script>

<template>
  <StickerImportDialog
    :open="stickerImportOpen"
    :storage="appInfo.storage"
    :stickers="stickerLibrary.stickers.value"
    :hint="stickerLibrary.hint.value"
    :hint-tone="stickerLibrary.hintTone.value"
    @close="$emit('close-sticker-import')"
    @import-files="$emit('import-sticker-files')"
    @import-folder="$emit('import-sticker-folder')"
    @open-sticker-folder="$emit('open-sticker-folder')"
    @rename-sticker="$emit('rename-sticker', $event)"
    @delete-sticker="$emit('delete-sticker', $event)"
    @move-sticker="$emit('move-sticker', $event)"
  />

  <ImageViewerDialog
    :open="imageViewerOpen"
    :title="imageViewerTitle"
    :src="imageViewerSrc"
    :loading="imageViewerLoading"
    :hint="imageViewerHint"
    :status-text="imageViewerStatusText"
    :can-download="Boolean(imageViewerActiveFile?.objectKey)"
    :can-copy="Boolean(imageViewerActiveFile?.objectKey)"
    :can-forward="Boolean(imageViewerOwnerMessageId)"
    :can-open-location="Boolean(imageViewerActiveFile?.transfer?.status === 'saved' && imageViewerActiveFile?.transfer?.path)"
    @close="$emit('close-image-viewer')"
    @download="$emit('download-image')"
    @copy="$emit('copy-image')"
    @forward="$emit('forward-image')"
    @open-location="$emit('open-image-location')"
  />
</template>

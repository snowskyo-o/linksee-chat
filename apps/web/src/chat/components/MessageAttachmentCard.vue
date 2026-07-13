<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { chatApi } from "../../shared/api-client.js";
import { createObjectUrlFromBlobLike } from "../../shared/blob-source.js";

const props = defineProps({
  file: { type: Object, required: true },
  isMe: { type: Boolean, default: false },
});

const emit = defineEmits(["download", "save-as", "open-image", "open-file", "open-file-location"]);

function handleFileClick() {
  if (props.file?.transfer?.status === "saved" && props.file?.transfer?.path) {
    emit("open-file", props.file);
    return;
  }
  emit("download", props.file);
}

function stopAndEmit(event, name) {
  event.stopPropagation();
  emit(name, props.file);
}

const imageSrc = ref("");
const imageLoading = ref(false);

function revokeImageSrc() {
  if (imageSrc.value?.startsWith("blob:")) URL.revokeObjectURL(imageSrc.value);
  imageSrc.value = "";
}

async function loadImagePreview() {
  revokeImageSrc();
  if (!props.file?.isImage || !props.file?.objectKey || props.file?.expired) return;
  imageLoading.value = true;
  try {
    const blob = await chatApi.getBlob(`/api/v1/chat/files/download?objectKey=${encodeURIComponent(props.file.objectKey)}`);
    imageSrc.value = await createObjectUrlFromBlobLike(blob, props.file?.mimeType || "image/png");
  } catch {
    imageSrc.value = "";
  } finally {
    imageLoading.value = false;
  }
}

watch(() => props.file?.objectKey, loadImagePreview, { immediate: true });
onBeforeUnmount(revokeImageSrc);
</script>

<template>
  <button
    v-if="file.isImage"
    class="message-image-card"
    :class="{ 'is-me': isMe, expired: file.expired }"
    type="button"
    :disabled="file.expired"
    @click="$emit('open-image', file)"
  >
    <img v-if="imageSrc" :src="imageSrc" :alt="file.name" />
    <span v-else class="message-image-placeholder">{{ imageLoading ? "加载中" : "图片" }}</span>
    <span class="message-image-copy">
      <strong>{{ file.name }}</strong>
      <small>
        {{ file.sizeText }}
        <template v-if="file.transfer?.status === 'saved'"> · 已保存</template>
        <template v-else-if="file.transfer?.status === 'failed'"> · 保存失败</template>
      </small>
    </span>
    <span class="message-image-actions">
      <span class="message-inline-action" @click.stop="$emit('open-image', file)">查看</span>
      <span
        class="message-inline-action"
        @click.stop="file.transfer?.status === 'saved' && file.transfer?.path ? $emit('open-file', file) : $emit('download', file)"
      >
        {{ file.transfer?.status === "saved" ? "打开" : "保存" }}
      </span>
      <span
        v-if="file.transfer?.status === 'saved' && file.transfer?.path"
        class="message-inline-action"
        @click.stop="$emit('open-file-location', file)"
      >
        位置
      </span>
    </span>
  </button>

  <button
    v-else
    class="message-file-card"
    :class="{ 'is-me': isMe, expired: file.expired, 'is-downloading': file.transfer?.status === 'downloading' }"
    type="button"
    :disabled="file.expired || file.transfer?.status === 'downloading'"
    @click="handleFileClick"
  >
    <div class="message-file-copy">
      <strong>{{ file.name }}</strong>
      <small>
        {{ file.metaText || file.sizeText }}
        <template v-if="file.transfer?.status === 'downloading'"> · {{ file.transfer.progress || 0 }}%</template>
        <template v-else-if="file.transfer?.status === 'saved'"> · 已保存</template>
        <template v-else-if="file.transfer?.status === 'failed'"> · 下载失败</template>
      </small>
      <div class="message-file-actions">
        <span class="message-inline-action" @click.stop="handleFileClick">
          {{ file.transfer?.status === "saved" ? "打开" : "下载" }}
        </span>
        <span class="message-inline-action" @click.stop="$emit('save-as', file)">另存为</span>
        <span
          v-if="file.transfer?.status === 'saved' && file.transfer?.path"
          class="message-inline-action"
          @click.stop="$emit('open-file-location', file)"
        >
          位置
        </span>
      </div>
    </div>
    <div class="message-file-icon">
      <svg v-if="file.transfer?.status === 'downloading'" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="14"></circle>
        <path :style="{ strokeDasharray: `${Math.max(2, file.transfer.progress || 0)} 100` }" d="M18 4a14 14 0 1 1 0 28a14 14 0 0 1 0-28Z"></path>
        <text x="18" y="22">{{ file.transfer.progress || 0 }}</text>
      </svg>
      <span v-else>{{ file.extensionLabel }}</span>
    </div>
  </button>
</template>

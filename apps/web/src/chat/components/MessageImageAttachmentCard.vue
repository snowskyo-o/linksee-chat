<script setup>
import { toRef } from "vue";
import { useMessageImagePreview } from "./useMessageImagePreview.js";

const props = defineProps({
  file: { type: Object, required: true },
  isMe: { type: Boolean, default: false },
});

defineEmits(["copy-image", "download", "forward", "open-file", "open-file-location", "open-image"]);

const { imageLoading, imageSrc } = useMessageImagePreview(toRef(props, "file"));
</script>

<template>
  <button
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
      <span class="message-inline-action" @click.stop="$emit('copy-image', file)">复制</span>
      <span class="message-inline-action" @click.stop="$emit('forward')">转发</span>
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
</template>

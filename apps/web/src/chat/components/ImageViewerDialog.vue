<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  src: { type: String, default: "" },
  loading: { type: Boolean, default: false },
  hint: { type: String, default: "" },
});

defineEmits(["close", "download"]);

const scale = ref(1);
const fitMode = ref(true);

const imageStyle = computed(() => (
  fitMode.value
    ? {}
    : { transform: `scale(${scale.value})` }
));

function zoomIn() {
  fitMode.value = false;
  scale.value = Math.min(3, Number((scale.value + 0.2).toFixed(1)));
}

function zoomOut() {
  fitMode.value = false;
  scale.value = Math.max(0.4, Number((scale.value - 0.2).toFixed(1)));
}

function resetFit() {
  fitMode.value = true;
  scale.value = 1;
}

watch(() => props.open, (nextValue) => {
  if (nextValue) resetFit();
});
</script>

<template>
  <div v-if="open" class="dialog-backdrop image-viewer-backdrop" @click.self="$emit('close')">
    <section class="image-viewer-dialog">
      <header class="image-viewer-toolbar">
        <strong>{{ title || "图片预览" }}</strong>
        <div class="image-viewer-actions">
          <button type="button" title="缩小" @click="zoomOut">−</button>
          <button type="button" title="适应窗口" @click="resetFit">{{ fitMode ? "适应" : `${Math.round(scale * 100)}%` }}</button>
          <button type="button" title="放大" @click="zoomIn">+</button>
          <button type="button" title="下载" @click="$emit('download')">下载</button>
          <button type="button" title="关闭" @click="$emit('close')">关闭</button>
        </div>
      </header>

      <div class="image-viewer-stage">
        <div v-if="loading" class="muted">正在加载图片...</div>
        <div v-else-if="hint" class="hint is-error">{{ hint }}</div>
        <img
          v-else-if="src"
          :src="src"
          :alt="title || 'preview'"
          class="image-viewer-image"
          :class="{ 'is-free-scale': !fitMode }"
          :style="imageStyle"
        />
        <div v-else class="muted">暂无可预览内容</div>
      </div>
    </section>
  </div>
</template>

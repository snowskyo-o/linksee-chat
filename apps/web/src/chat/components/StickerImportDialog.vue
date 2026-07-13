<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  storage: { type: Object, default: null },
  stickers: { type: Array, default: () => [] },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
});

const emit = defineEmits(["close", "import-files", "import-folder", "open-sticker-folder", "rename-sticker", "delete-sticker", "move-sticker"]);
const renameDrafts = ref({});
const stickerIds = computed(() => props.stickers.map((item) => item.id));

watch(() => [props.open, props.stickers], () => {
  renameDrafts.value = Object.fromEntries(props.stickers.map((item) => [item.id, item.name || ""]));
}, { deep: true, immediate: true });

function saveRename(sticker) {
  const nextName = String(renameDrafts.value[sticker.id] || "").trim();
  if (!nextName || nextName === sticker.name) return;
  emit("rename-sticker", { id: sticker.id, name: nextName });
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card sticker-import-dialog">
      <header class="dialog-head">
        <div>
          <h3>管理自定义表情</h3>
          <p class="muted">支持导入、重命名、删除和排序，本地修改会立即同步到表情面板。</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <div class="sticker-import-grid">
        <button class="sticker-import-action" type="button" @click="$emit('import-files')">
          <strong>导入图片</strong>
          <span>选择 PNG、JPG、GIF、WEBP 等图片，直接加入本地表情库。</span>
        </button>
        <button class="sticker-import-action" type="button" @click="$emit('import-folder')">
          <strong>导入文件夹</strong>
          <span>递归扫描一个文件夹中的图片，适合批量迁移已有表情包。</span>
        </button>
      </div>

      <div class="settings-meta-list">
        <div class="settings-meta-row"><span>本地表情包目录</span><strong>{{ storage?.stickers || "-" }}</strong></div>
      </div>

      <div v-if="hint" class="hint" :class="hintTone === 'error' ? 'is-error' : 'is-success'">{{ hint }}</div>

      <div v-if="stickers.length" class="sticker-manager-list">
        <article v-for="sticker in stickers" :key="sticker.id" class="sticker-manager-item">
          <img :src="sticker.src" :alt="sticker.name" class="sticker-manager-preview" />
          <input v-model="renameDrafts[sticker.id]" class="field-input sticker-manager-input" @keydown.enter.prevent="saveRename(sticker)" />
          <div class="sticker-manager-actions">
            <button class="ghost-btn compact-btn" type="button" :disabled="sticker.id === stickerIds[0]" @click="$emit('move-sticker', { id: sticker.id, direction: -1 })">上移</button>
            <button class="ghost-btn compact-btn" type="button" :disabled="sticker.id === stickerIds[stickerIds.length - 1]" @click="$emit('move-sticker', { id: sticker.id, direction: 1 })">下移</button>
            <button class="ghost-btn compact-btn" type="button" @click="saveRename(sticker)">保存</button>
            <button class="ghost-btn compact-btn" type="button" @click="$emit('delete-sticker', sticker.id)">删除</button>
          </div>
        </article>
      </div>
      <div v-else class="state-panel">
        <strong>还没有自定义表情</strong>
        <p>先导入一些本地图片，后续就可以在这里统一管理。</p>
      </div>

      <div class="dialog-actions">
        <button class="ghost-btn" type="button" @click="$emit('open-sticker-folder')">打开本地目录</button>
        <button class="primary-btn" type="button" @click="$emit('close')">完成</button>
      </div>
    </section>
  </div>
</template>

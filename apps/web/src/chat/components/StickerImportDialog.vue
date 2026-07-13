<script setup>
defineProps({
  open: { type: Boolean, default: false },
  storage: { type: Object, default: null },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
});

defineEmits(["close", "import-files", "import-folder", "open-sticker-folder"]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card sticker-import-dialog">
      <header class="dialog-head">
        <div>
          <h3>导入表情包</h3>
          <p class="muted">支持单张图片、整文件夹导入。QQ 和微信表情目录版本差异较大，建议手动定位后导入。</p>
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

      <div class="dialog-actions">
        <button class="ghost-btn" type="button" @click="$emit('open-sticker-folder')">打开本地目录</button>
        <button class="primary-btn" type="button" @click="$emit('close')">完成</button>
      </div>
    </section>
  </div>
</template>

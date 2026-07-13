<script setup>
defineProps({
  shell: { type: Object, required: true },
  showReplyBar: { type: Boolean, default: false },
  uploadingFiles: { type: Boolean, default: false },
  uploadProgressText: { type: String, default: "" },
  downloadProgressText: { type: String, default: "" },
});

defineEmits(["cancel-edit", "toggle-emoji", "toggle-sticker", "capture-screenshot", "open-file-picker"]);
</script>

<template>
  <div class="composer-top desktop-composer-top">
    <div class="composer-tool-group qq-composer-toolbar">
      <button v-if="showReplyBar" class="ghost-btn compact-btn" type="button" @click="$emit('cancel-edit')">取消回复</button>
      <button class="qq-chat-tool-btn is-emoji" type="button" title="表情" @click="$emit('toggle-emoji')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20Zm-3 7a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 9 9Zm6 0a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 15 9Zm-6.18 5.36a1 1 0 0 0-1.64 1.14A5.98 5.98 0 0 0 12 18a5.98 5.98 0 0 0 4.82-2.5a1 1 0 1 0-1.64-1.14A3.98 3.98 0 0 1 12 16a3.98 3.98 0 0 1-3.18-1.64Z"/></svg>
      </button>
      <button v-if="shell.isDesktop" class="qq-chat-tool-btn is-sticker" type="button" title="表情包" @click="$emit('toggle-sticker')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v7.5A6.5 6.5 0 0 1 14.5 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm9.5 14A4.5 4.5 0 0 0 19 13.5V6H5v12h9.5ZM8 9.25a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5Zm5 0a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5Zm-5.2 5.52a1 1 0 0 0 .4 1.36c1.14.64 2.4.97 3.8.97c1.4 0 2.66-.33 3.8-.97a1 1 0 0 0-.96-1.76c-.83.46-1.75.69-2.84.69s-2.01-.23-2.84-.69a1 1 0 0 0-1.36.4Z"/></svg>
      </button>
      <button v-if="shell.isDesktop" class="qq-chat-tool-btn" type="button" title="截图" :disabled="uploadingFiles" @click="$emit('capture-screenshot')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 7.8 6H5a2 2 0 0 0-2 2v9a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8a2 2 0 0 0-2-2h-2.8L15 4H9Zm3 4.25A4.75 4.75 0 1 1 7.25 13 4.76 4.76 0 0 1 12 8.25Zm0 2A2.75 2.75 0 1 0 14.75 13 2.75 2.75 0 0 0 12 10.25Z"/></svg>
      </button>
      <button class="qq-chat-tool-btn" type="button" title="发送文件" :disabled="uploadingFiles" @click="$emit('open-file-picker')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 7H9.83l-2-2H5a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V9c0-1.1-.9-2-2-2Zm0 10H5V7h2l2 2h10v8Z"/></svg>
      </button>
    </div>
    <div v-if="uploadProgressText || downloadProgressText" class="search-bar upload-inline-tip">
      {{ uploadProgressText || downloadProgressText }}
    </div>
  </div>
</template>

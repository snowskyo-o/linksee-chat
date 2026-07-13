<script setup>
import { onBeforeUnmount, ref } from "vue";

const props = defineProps({
  canDelete: { type: Boolean, default: false },
  errorText: { type: String, default: "" },
});

const emit = defineEmits(["retry", "delete"]);
const open = ref(false);

function close() {
  open.value = false;
}

function handlePointerDown(event) {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest(".message-failure-actions")) return;
  close();
}

window.addEventListener("pointerdown", handlePointerDown);
onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handlePointerDown);
});
</script>

<template>
  <div class="message-failure-actions">
    <button
      class="message-failure-trigger"
      type="button"
      :title="errorText || '发送失败'"
      aria-label="发送失败"
      @click.stop="open = !open"
    >
      !
    </button>
    <div v-if="open" class="message-failure-menu">
      <button type="button" @click.stop="close(); emit('retry')">重新发送</button>
      <button v-if="canDelete" type="button" class="is-danger" @click.stop="close(); emit('delete')">删除消息</button>
    </div>
  </div>
</template>

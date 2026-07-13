<script setup>
import NewFriendsDialogContent from "./NewFriendsDialogContent.vue";
import { newFriendsDialogEmits, newFriendsDialogProps } from "./new-friends-dialog-contract.js";

const props = defineProps(newFriendsDialogProps);
const emit = defineEmits(newFriendsDialogEmits);

const contentListeners = {
  "accept-request": (requestId) => emit("accept-request", requestId),
  "cancel-request": (requestId) => emit("cancel-request", requestId),
  "edit-friend": (contact) => emit("edit-friend", contact),
  "reject-request": (requestId) => emit("reject-request", requestId),
  "remove-friend": (contactId) => emit("remove-friend", contactId),
  "send-request": (contactId) => emit("send-request", contactId),
  "start-chat": (contactId) => emit("start-chat", contactId),
  "update:keyword": (value) => emit("update:keyword", value),
};
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card new-friends-dialog-card">
      <header class="dialog-head">
        <div>
          <h3>新朋友</h3>
          <p class="muted">查找联系人并快速发起新的私聊会话</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <NewFriendsDialogContent v-bind="props" v-on="contentListeners" />
    </section>
  </div>
</template>

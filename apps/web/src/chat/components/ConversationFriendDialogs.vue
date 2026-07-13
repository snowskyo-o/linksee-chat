<script setup>
import NewFriendsDialog from "./NewFriendsDialog.vue";

defineProps({
  friendCenter: { type: Object, default: () => ({}) },
});

defineEmits(["edit-friend", "start-chat"]);
</script>

<template>
  <NewFriendsDialog
    :open="friendCenter.open.value"
    :keyword="friendCenter.keyword.value"
    :loading="friendCenter.loading.value"
    :hint="friendCenter.hint.value"
    :hint-tone="friendCenter.hintTone.value"
    :recent-contacts="friendCenter.recentContacts.value"
    :incoming-requests="friendCenter.incomingRequests.value"
    :outgoing-requests="friendCenter.outgoingRequests.value"
    :recommended-users="friendCenter.recommendedUsers.value"
    :friend-contacts="friendCenter.friendContacts.value"
    @close="friendCenter.closeCenter()"
    @update:keyword="friendCenter.keyword.value = $event"
    @start-chat="$emit('start-chat', $event)"
    @edit-friend="$emit('edit-friend', $event)"
    @remove-friend="friendCenter.removeFriend($event).catch(() => {})"
    @send-request="friendCenter.sendRequest"
    @accept-request="friendCenter.resolveRequest($event, 'accept', '已通过好友申请')"
    @reject-request="friendCenter.resolveRequest($event, 'reject', '已拒绝好友申请')"
    @cancel-request="friendCenter.resolveRequest($event, 'cancel', '已取消好友申请')"
  />
</template>

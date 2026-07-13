<script setup>
import { computed, ref, watch } from "vue";
import InfoSidebarBlank from "./InfoSidebarBlank.vue";
import InfoSidebarDirectCard from "./InfoSidebarDirectCard.vue";
import InfoSidebarGroupCard from "./InfoSidebarGroupCard.vue";
import InfoSidebarMembersCard from "./InfoSidebarMembersCard.vue";

const props = defineProps({
  conversation: { type: Object, default: null },
  participants: { type: Array, default: () => [] },
  currentUserId: { type: String, default: "" },
  standaloneMode: { type: Boolean, default: false },
});

const emit = defineEmits(["rename-group", "invite-group-members", "leave-group", "remove-group-member"]);

const participantRows = computed(() => (Array.isArray(props.participants) ? props.participants : []).map((user) => ({
  ...user,
  name: user?.friendAlias || user?.profile?.realName || user?.id || "未命名用户",
  account: user?.id || "",
  bio: user?.profile?.bio || "这个成员还没有留下签名",
  isMe: String(user?.id || "") === String(props.currentUserId || ""),
  isOwner: String(user?.id || "") === String(props.conversation?.createdBy || ""),
})));

const directPeer = computed(() => participantRows.value.find((user) => !user.isMe) || participantRows.value[0] || null);
const isGroupOwner = computed(() => (
  props.conversation?.kind === "group" && String(props.conversation?.createdBy || "") === String(props.currentUserId || "")
));
const groupTitleDraft = ref("");

const infoRows = computed(() => {
  const peer = directPeer.value;
  if (!peer) return [];
  return [
    { label: "昵称", value: peer.name || "未设置" },
    { label: "账号", value: peer.account || "未知账号" },
    { label: "签名", value: peer.bio || "这个联系人还没有留下签名" },
  ];
});

watch(
  () => [props.conversation?.id, props.conversation?.title],
  () => {
    groupTitleDraft.value = String(props.conversation?.title || "");
  },
  { immediate: true },
);
</script>

<template>
  <aside class="chat-detail-panel" :class="{ 'is-standalone': standaloneMode }">
    <InfoSidebarBlank v-if="!conversation" :standalone-mode="standaloneMode" />

    <template v-else-if="conversation.kind === 'direct'">
      <InfoSidebarDirectCard
        :direct-peer="directPeer"
        :info-rows="infoRows"
        :standalone-mode="standaloneMode"
      />
    </template>

    <template v-else>
      <InfoSidebarGroupCard
        :conversation="conversation"
        :group-title-draft="groupTitleDraft"
        :is-group-owner="isGroupOwner"
        :participant-count="participantRows.length"
        :standalone-mode="standaloneMode"
        @update:group-title-draft="groupTitleDraft = $event"
        @rename-group="emit('rename-group', $event)"
        @invite-group-members="emit('invite-group-members')"
        @leave-group="emit('leave-group')"
      />

      <InfoSidebarMembersCard
        :is-group-owner="isGroupOwner"
        :participant-rows="participantRows"
        :standalone-mode="standaloneMode"
        @remove-group-member="emit('remove-group-member', $event)"
      />
    </template>
  </aside>
</template>

<style scoped>
</style>

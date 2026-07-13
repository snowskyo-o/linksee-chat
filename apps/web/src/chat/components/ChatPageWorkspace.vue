<script setup>
import ConversationSidebar from "./ConversationSidebar.vue";
import InfoSidebar from "./InfoSidebar.vue";
import MessagePanel from "./MessagePanel.vue";
import {
  createConversationSidebarProps,
  createInfoSidebarProps,
  createMessagePanelListeners,
  createMessagePanelProps,
} from "./chat-page-workspace-bindings.js";
import { chatPageWorkspaceProps } from "./chat-page-workspace-contract.js";

const props = defineProps(chatPageWorkspaceProps);
const emit = defineEmits(["logout"]);
const conversationSidebarProps = createConversationSidebarProps(props);
const infoSidebarProps = createInfoSidebarProps(props);
const messagePanelListeners = createMessagePanelListeners(props);
const messagePanelProps = createMessagePanelProps(props);
</script>

<template>
  <section
    class="qq-shell"
    :class="{
      'is-conversation-window': props.standaloneConversationMode,
      'has-standalone-sidebar': props.runtime.showStandaloneInfoSidebar,
    }"
  >
    <ConversationSidebar
      v-if="!props.standaloneConversationMode"
      v-bind="conversationSidebarProps"
      @update:keyword="props.store.conversationKeyword.value = $event"
      @select="props.selectConversation"
      @refresh="props.actions.refreshAll"
      @new-direct="props.actions.createDirectConversation"
      @new-group="props.actions.createGroupConversation"
      @open-settings="props.runtime.openSettings"
      @toggle-pin="props.actions.toggleConversationPinById"
      @logout="emit('logout')"
      @retry-load="props.runtime.reloadConversationList"
    />

    <MessagePanel
      v-bind="messagePanelProps"
      v-on="messagePanelListeners"
    />

    <InfoSidebar
      v-if="!props.standaloneConversationMode || props.runtime.showStandaloneInfoSidebar"
      v-bind="infoSidebarProps"
      @rename-group="props.groupManagement.renameGroup"
      @invite-group-members="props.groupManagement.openInviteDialog"
      @leave-group="props.groupManagement.requestLeaveGroup"
      @remove-group-member="props.groupManagement.requestRemoveMember"
    />
  </section>
</template>

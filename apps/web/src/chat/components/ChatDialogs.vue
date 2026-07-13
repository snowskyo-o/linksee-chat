<script setup>
import AnnouncementDialog from "./AnnouncementDialog.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import CreateConversationDialog from "./CreateConversationDialog.vue";
import ForwardDialog from "./ForwardDialog.vue";
import GroupInviteDialog from "./GroupInviteDialog.vue";
import ImageViewerDialog from "./ImageViewerDialog.vue";
import SettingsDialog from "./SettingsDialog.vue";
import StickerImportDialog from "./StickerImportDialog.vue";
import ToastStack from "./ToastStack.vue";
import UpdatePromptDialog from "./UpdatePromptDialog.vue";

defineProps({
  standaloneConversationMode: { type: Boolean, default: false },
  updatePromptOpen: { type: Boolean, default: false },
  appInfo: { type: Object, default: () => ({}) },
  settingsOpen: { type: Boolean, default: false },
  appSettings: { type: Object, default: () => ({}) },
  desktopPreferences: { type: Object, default: () => ({}) },
  auth: { type: Object, default: () => ({}) },
  store: { type: Object, default: () => ({}) },
  passwordChange: { type: Object, default: () => ({}) },
  stickerImportOpen: { type: Boolean, default: false },
  stickerLibrary: { type: Object, default: () => ({}) },
  imageViewerOpen: { type: Boolean, default: false },
  imageViewerTitle: { type: String, default: "" },
  imageViewerSrc: { type: String, default: "" },
  imageViewerLoading: { type: Boolean, default: false },
  imageViewerHint: { type: String, default: "" },
  imageViewerStatusText: { type: String, default: "" },
  imageViewerActiveFile: { type: Object, default: null },
  imageViewerOwnerMessageId: { type: String, default: "" },
  groupManagement: { type: Object, default: () => ({}) },
  actions: { type: Object, default: () => ({}) },
});

defineEmits([
  "update-now",
  "remind-later",
  "close-update",
  "close-settings",
  "update:settings",
  "update:desktop-preferences",
  "update:profile-name",
  "update:profile-bio",
  "save-profile",
  "submit-password",
  "logout",
  "upload-avatar",
  "choose-download-dir",
  "open-download-dir",
  "clear-cache",
  "open-update",
  "close-sticker-import",
  "import-sticker-files",
  "import-sticker-folder",
  "open-sticker-folder",
  "rename-sticker",
  "delete-sticker",
  "move-sticker",
  "close-image-viewer",
  "download-image",
  "copy-image",
  "forward-image",
  "open-image-location",
]);
</script>

<template>
  <ToastStack :notifications="store.notifications.value" @dismiss="store.dismissNotification" />

  <UpdatePromptDialog
    :open="updatePromptOpen"
    :update="appInfo.update"
    @update-now="$emit('update-now')"
    @remind-later="$emit('remind-later')"
    @close="$emit('close-update')"
  />

  <SettingsDialog
    :open="settingsOpen"
    :settings="appSettings"
    :desktop-preferences="desktopPreferences"
    :profile-account="store.me.value?.id || auth.userId"
    :profile-role="store.me.value?.role || auth.role"
    :profile-name="store.profileName.value"
    :profile-bio="store.profileBio.value"
    :profile-hint="store.profileHint.value"
    :profile-hint-tone="store.profileHintTone.value"
    :password-hint="passwordChange.passwordHint.value"
    :password-hint-tone="passwordChange.passwordHintTone.value"
    :password-submitting="passwordChange.passwordSubmitting.value"
    :me-avatar-url="store.meAvatarUrl.value"
    :app-info="appInfo"
    @close="$emit('close-settings')"
    @update:settings="$emit('update:settings', $event)"
    @update:desktop-preferences="$emit('update:desktop-preferences', $event)"
    @update:profile-name="$emit('update:profile-name', $event)"
    @update:profile-bio="$emit('update:profile-bio', $event)"
    @save-profile="$emit('save-profile')"
    @submit-password="$emit('submit-password', $event)"
    @logout="$emit('logout')"
    @upload-avatar="$emit('upload-avatar', $event)"
    @choose-download-dir="$emit('choose-download-dir')"
    @open-download-dir="$emit('open-download-dir')"
    @clear-cache="$emit('clear-cache')"
    @open-update="$emit('open-update')"
  />

  <StickerImportDialog
    :open="stickerImportOpen"
    :storage="appInfo.storage"
    :stickers="stickerLibrary.stickers.value"
    :hint="stickerLibrary.hint.value"
    :hint-tone="stickerLibrary.hintTone.value"
    @close="$emit('close-sticker-import')"
    @import-files="$emit('import-sticker-files')"
    @import-folder="$emit('import-sticker-folder')"
    @open-sticker-folder="$emit('open-sticker-folder')"
    @rename-sticker="$emit('rename-sticker', $event)"
    @delete-sticker="$emit('delete-sticker', $event)"
    @move-sticker="$emit('move-sticker', $event)"
  />

  <ImageViewerDialog
    :open="imageViewerOpen"
    :title="imageViewerTitle"
    :src="imageViewerSrc"
    :loading="imageViewerLoading"
    :hint="imageViewerHint"
    :status-text="imageViewerStatusText"
    :can-download="Boolean(imageViewerActiveFile?.objectKey)"
    :can-copy="Boolean(imageViewerActiveFile?.objectKey)"
    :can-forward="Boolean(imageViewerOwnerMessageId)"
    :can-open-location="Boolean(imageViewerActiveFile?.transfer?.status === 'saved' && imageViewerActiveFile?.transfer?.path)"
    @close="$emit('close-image-viewer')"
    @download="$emit('download-image')"
    @copy="$emit('copy-image')"
    @forward="$emit('forward-image')"
    @open-location="$emit('open-image-location')"
  />

  <ForwardDialog
    :open="store.forwardDialogOpen.value"
    :conversations="store.filteredConversations.value"
    :selected-id="store.forwardConversationId.value"
    :hint="store.forwardHint.value"
    :submitting="store.forwardSubmitting.value"
    @close="store.closeForwardDialog"
    @update:selected-id="store.forwardConversationId.value = $event"
    @submit="actions.submitForwardMessage"
  />

  <GroupInviteDialog
    :open="groupManagement.inviteDialogOpen.value"
    :contacts="groupManagement.inviteableContacts.value"
    :selected-ids="groupManagement.inviteParticipantIds.value"
    :hint="groupManagement.inviteHint.value"
    :hint-tone="groupManagement.inviteHintTone.value"
    :submitting="groupManagement.inviteSubmitting.value"
    @close="groupManagement.closeInviteDialog"
    @toggle-contact="groupManagement.toggleInviteParticipant"
    @submit="groupManagement.submitInviteMembers"
  />

  <CreateConversationDialog
    v-if="!standaloneConversationMode"
    :open="store.createDialogOpen.value"
    :mode="store.createDialogMode.value"
    :title="store.createDialogTitle.value"
    :peer-id="store.selectedPeerId.value"
    :participant-ids="store.createDialogParticipantIds.value"
    :contacts="store.createDialogContacts.value"
    :selected-participants="store.selectedParticipants.value"
    :hint="store.createDialogHint.value"
    :hint-tone="store.createDialogHintTone.value"
    :submitting="store.createDialogSubmitting.value"
    @close="store.closeCreateDialog"
    @submit="actions.submitCreateConversation"
    @update:title="store.createDialogTitle.value = $event"
    @update:peer-id="store.createDialogPeerId.value = $event"
    @toggle-participant="store.toggleDialogParticipant"
  />

  <AnnouncementDialog
    :open="store.announcementDialogOpen.value"
    :draft="store.announcementDraft.value"
    :hint="store.announcementHint.value"
    :hint-tone="store.announcementHintTone.value"
    :submitting="store.announcementSubmitting.value"
    @close="store.closeAnnouncementDialog"
    @submit="actions.submitAnnouncement"
    @update:draft="store.announcementDraft.value = $event"
  />

  <ConfirmDialog
    :open="store.confirmDialogOpen.value"
    :title="store.confirmDialogTitle.value"
    :message="store.confirmDialogMessage.value"
    :confirm-text="store.confirmDialogConfirmText.value"
    :submitting="store.confirmDialogSubmitting.value"
    @close="store.closeConfirmDialog"
    @submit="actions.submitConfirmDialog"
  />
</template>

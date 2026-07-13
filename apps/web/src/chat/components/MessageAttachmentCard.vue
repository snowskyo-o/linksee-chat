<script setup>
import MessageFileAttachmentCard from "./MessageFileAttachmentCard.vue";
import MessageImageAttachmentCard from "./MessageImageAttachmentCard.vue";

const props = defineProps({
  file: { type: Object, required: true },
  isMe: { type: Boolean, default: false },
});

defineEmits(["copy-image", "download", "forward", "save-as", "open-image", "open-file", "open-file-location"]);
</script>

<template>
  <MessageImageAttachmentCard
    v-if="file.isImage"
    :file="file"
    :is-me="isMe"
    @copy-image="$emit('copy-image', $event)"
    @download="$emit('download', $event)"
    @forward="$emit('forward')"
    @open-image="$emit('open-image', $event)"
    @open-file="$emit('open-file', $event)"
    @open-file-location="$emit('open-file-location', $event)"
  />

  <MessageFileAttachmentCard
    v-else
    :file="file"
    :is-me="isMe"
    @download="$emit('download', $event)"
    @save-as="$emit('save-as', $event)"
    @open-file="$emit('open-file', $event)"
    @open-file-location="$emit('open-file-location', $event)"
  />
</template>

export const chatComposerProps = {
  showReplyBar: { type: Boolean, default: false },
  replyText: { type: String, default: "" },
  messageInput: { type: String, default: "" },
  mentionOpen: { type: Boolean, default: false },
  mentionOptions: { type: Array, default: () => [] },
  composerHint: { type: String, default: "" },
  composerHintTone: { type: String, default: "" },
  pendingFiles: { type: Array, default: () => [] },
  uploadingFiles: { type: Boolean, default: false },
  uploadProgressText: { type: String, default: "" },
  downloadProgressText: { type: String, default: "" },
  recentStickers: { type: Array, default: () => [] },
  stickers: { type: Array, default: () => [] },
  stickersLoading: { type: Boolean, default: false },
  stickersHint: { type: String, default: "" },
  stickersHintTone: { type: String, default: "" },
};

export const chatComposerEmits = [
  "cancel-edit", "update:messageInput", "message-keydown", "mention-pick", "submit",
  "open-file-picker", "capture-screenshot", "open-sticker-import", "send-sticker",
  "clear-recent-stickers", "file-change", "file-paste", "remove-pending-file",
];

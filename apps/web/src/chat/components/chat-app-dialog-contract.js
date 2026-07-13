export const chatAppDialogProps = {
  appInfo: { type: Object, default: () => ({}) },
  appSettings: { type: Object, default: () => ({}) },
  auth: { type: Object, default: () => ({}) },
  desktopPreferences: { type: Object, default: () => ({}) },
  imageViewerActiveFile: { type: Object, default: null },
  imageViewerHint: { type: String, default: "" },
  imageViewerLoading: { type: Boolean, default: false },
  imageViewerOpen: { type: Boolean, default: false },
  imageViewerOwnerMessageId: { type: String, default: "" },
  imageViewerSrc: { type: String, default: "" },
  imageViewerStatusText: { type: String, default: "" },
  imageViewerTitle: { type: String, default: "" },
  passwordChange: { type: Object, default: () => ({}) },
  settingsOpen: { type: Boolean, default: false },
  stickerImportOpen: { type: Boolean, default: false },
  stickerLibrary: { type: Object, default: () => ({}) },
  store: { type: Object, default: () => ({}) },
  updatePromptOpen: { type: Boolean, default: false },
};

export const chatAppDialogEmits = [
  "choose-download-dir", "clear-cache", "close-image-viewer", "close-settings", "close-sticker-import",
  "close-update", "copy-image", "delete-sticker", "download-image", "forward-image", "import-sticker-files",
  "import-sticker-folder", "logout", "move-sticker", "open-download-dir", "open-image-location",
  "open-sticker-folder", "open-update", "remind-later", "rename-sticker", "save-profile", "submit-password",
  "update-now", "update:desktop-preferences", "update:profile-bio", "update:profile-name", "update:settings",
  "upload-avatar",
];

import { createChatFileDownloadClipboard } from "./chat-file-download-clipboard.js";
import { createChatFileDownloadCore } from "./chat-file-download-core.js";
import { createChatFileDownloadOpenActions } from "./chat-file-download-open-actions.js";

export function createChatFileDownloadActions({ store, autoReceiveQueue }) {
  const coreActions = createChatFileDownloadCore({ store });
  const openActions = createChatFileDownloadOpenActions({
    store,
    downloadFile: coreActions.downloadFile,
  });
  const clipboardActions = createChatFileDownloadClipboard({ store });

  return {
    autoReceiveImages: (files = []) => openActions.autoReceiveImages(files, autoReceiveQueue),
    copyImageToClipboard: clipboardActions.copyImageToClipboard,
    downloadFile: coreActions.downloadFile,
    openFile: openActions.openFile,
    openFileLocation: openActions.openFileLocation,
    saveFileAs: openActions.saveFileAs,
  };
}

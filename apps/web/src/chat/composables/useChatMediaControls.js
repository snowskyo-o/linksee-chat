import { useChatComposerMediaControls } from "./useChatComposerMediaControls.js";
import { useChatImageViewer } from "./useChatImageViewer.js";
import { useChatStickerControls } from "./useChatStickerControls.js";

export function useChatMediaControls({ store, actions, stickerLibrary, appInfo }) {
  const composerMedia = useChatComposerMediaControls({ store, actions });
  const stickerControls = useChatStickerControls({ store, actions, stickerLibrary, appInfo });
  const imageViewer = useChatImageViewer({ store, actions });

  return {
    ...composerMedia,
    ...stickerControls,
    ...imageViewer,
  };
}

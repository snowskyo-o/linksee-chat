import { useChatDesktopSettingsControls } from "./useChatDesktopSettingsControls.js";
import { useChatDesktopStorageControls } from "./useChatDesktopStorageControls.js";
import { useChatDesktopUpdateControls } from "./useChatDesktopUpdateControls.js";

export function useChatDesktopControls({ store, actions }) {
  const updateControls = useChatDesktopUpdateControls();
  const settingsControls = useChatDesktopSettingsControls({
    store,
    actions,
    appInfo: updateControls.appInfo,
  });
  const storageControls = useChatDesktopStorageControls({
    store,
    appInfo: updateControls.appInfo,
    desktopPreferences: settingsControls.desktopPreferences,
    persistDesktopPreferences: settingsControls.persistDesktopPreferences,
  });

  return {
    ...updateControls,
    ...settingsControls,
    ...storageControls,
  };
}

import { ref } from "vue";
import { applyAppearanceMode } from "../../shared/appearance-mode.js";
import { loadAppSettings, saveAppSettings } from "../../shared/app-settings.js";
import { mergeDesktopPreferences } from "../../shared/desktop-preferences.js";

export function useChatDesktopSettingsControls({ store, actions, appInfo }) {
  const settingsOpen = ref(false);
  const appSettings = ref(loadAppSettings());
  const desktopPreferences = ref(mergeDesktopPreferences());

  function syncAppearance() {
    applyAppearanceMode(appSettings.value.appearance?.themeMode || "system");
  }

  function applyDesktopPreferenceState(payload = {}) {
    desktopPreferences.value = mergeDesktopPreferences(payload.preferences || payload.desktopPreferences);
    if (payload.storage) appInfo.value = { ...appInfo.value, storage: payload.storage };
  }

  function openSettings() {
    settingsOpen.value = true;
  }

  function closeSettings() {
    settingsOpen.value = false;
  }

  function persistSettings(nextSettings) {
    appSettings.value = saveAppSettings(nextSettings);
    syncAppearance();
  }

  async function persistDesktopPreferences(nextPreferences) {
    if (typeof window.desktopShell?.updateDesktopPreferences !== "function") {
      desktopPreferences.value = mergeDesktopPreferences(nextPreferences);
      return;
    }
    const payload = await window.desktopShell.updateDesktopPreferences(nextPreferences).catch(() => null);
    if (payload) {
      applyDesktopPreferenceState(payload);
      return;
    }
    desktopPreferences.value = mergeDesktopPreferences(nextPreferences);
  }

  function handleAvatarUpload(event) {
    const file = event.target?.files?.[0];
    actions.uploadAvatar(file).catch((error) => {
      store.profileHint.value = error?.message || "头像上传失败";
      store.profileHintTone.value = "error";
    });
  }

  return {
    appSettings,
    applyDesktopPreferenceState,
    closeSettings,
    desktopPreferences,
    handleAvatarUpload,
    openSettings,
    persistDesktopPreferences,
    persistSettings,
    settingsOpen,
    syncAppearance,
  };
}

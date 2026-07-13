import { applyAppearanceMode, watchSystemAppearance } from "../shared/appearance-mode.js";
import { subscribeAppSettings } from "../shared/app-settings.js";

export function useLoginPageAppearance(appSettings) {
  let detachAppSettings = null;
  let detachSystemAppearance = null;

  function syncAppearance() {
    applyAppearanceMode(appSettings.value.appearance?.themeMode || "system");
  }

  function mountAppearance() {
    syncAppearance();
    detachAppSettings = subscribeAppSettings((nextSettings) => {
      appSettings.value = nextSettings;
      syncAppearance();
    });
    detachSystemAppearance = watchSystemAppearance(() => {
      if ((appSettings.value.appearance?.themeMode || "system") === "system") syncAppearance();
    });
  }

  function unmountAppearance() {
    if (typeof detachAppSettings === "function") detachAppSettings();
    if (typeof detachSystemAppearance === "function") detachSystemAppearance();
  }

  return { mountAppearance, unmountAppearance };
}

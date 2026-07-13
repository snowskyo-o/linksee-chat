const STORAGE_KEY = "linksee_chat_settings";
const SETTINGS_EVENT = "linksee:app-settings";

export function getDefaultAppSettings() {
  return {
    notifications: {
      desktopEnabled: true,
      soundEnabled: true,
    },
    files: {
      autoReceiveImages: false,
    },
    general: {
      openLinksExternally: true,
      sendShortcut: "enter",
    },
    appearance: {
      themeMode: "system",
    },
  };
}

function normalizeSendShortcut(value, legacySendByEnter = true) {
  if (value === "ctrlEnter") return "ctrlEnter";
  if (value === "enter") return "enter";
  return legacySendByEnter === false ? "ctrlEnter" : "enter";
}

function mergeSettings(base, overrides) {
  const nextGeneral = {
    ...base.general,
    ...(overrides?.general || {}),
  };
  return {
    notifications: {
      ...base.notifications,
      ...(overrides?.notifications || {}),
    },
    files: {
      ...(base.files || {}),
      ...(overrides?.files || {}),
    },
    general: {
      ...nextGeneral,
      sendShortcut: normalizeSendShortcut(
        overrides?.general?.sendShortcut,
        overrides?.general?.sendByEnter ?? base.general.sendShortcut === "enter",
      ),
    },
    appearance: {
      ...(base.appearance || {}),
      themeMode: ["light", "dark", "system"].includes(overrides?.appearance?.themeMode)
        ? overrides.appearance.themeMode
        : (base.appearance?.themeMode || "system"),
    },
  };
}

export function loadAppSettings() {
  const defaults = getDefaultAppSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return mergeSettings(defaults, JSON.parse(raw));
  } catch {
    return defaults;
  }
}

export function saveAppSettings(settings) {
  const nextValue = mergeSettings(getDefaultAppSettings(), settings);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: nextValue }));
  return nextValue;
}

export function subscribeAppSettings(callback) {
  if (typeof callback !== "function") return () => {};
  const settingsHandler = (event) => callback(mergeSettings(getDefaultAppSettings(), event.detail || {}));
  const storageHandler = (event) => {
    if (event.key && event.key !== STORAGE_KEY) return;
    callback(loadAppSettings());
  };
  window.addEventListener(SETTINGS_EVENT, settingsHandler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, settingsHandler);
    window.removeEventListener("storage", storageHandler);
  };
}

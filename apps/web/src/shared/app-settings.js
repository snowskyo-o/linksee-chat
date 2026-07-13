const STORAGE_KEY = "linksee_chat_settings";

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
  return nextValue;
}

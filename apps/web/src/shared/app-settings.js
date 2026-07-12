const STORAGE_KEY = "linksee_chat_settings";

export function getDefaultAppSettings() {
  return {
    notifications: {
      desktopEnabled: true,
      soundEnabled: true,
    },
    general: {
      openLinksExternally: true,
      sendByEnter: true,
      minimizeToTray: true,
    },
  };
}

function mergeSettings(base, overrides) {
  return {
    notifications: {
      ...base.notifications,
      ...(overrides?.notifications || {}),
    },
    general: {
      ...base.general,
      ...(overrides?.general || {}),
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

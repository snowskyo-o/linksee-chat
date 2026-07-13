export function getDefaultDesktopPreferences() {
  return {
    downloadsDir: "",
    launchOnStartup: false,
    notificationsMuted: false,
    closeToTray: true,
  };
}

export function mergeDesktopPreferences(overrides) {
  return {
    ...getDefaultDesktopPreferences(),
    ...(overrides || {}),
  };
}

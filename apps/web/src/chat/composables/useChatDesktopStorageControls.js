export function useChatDesktopStorageControls({ store, appInfo, desktopPreferences, persistDesktopPreferences }) {
  async function chooseDownloadDirectory() {
    if (typeof window.desktopShell?.chooseDirectory !== "function") return;
    const folder = await window.desktopShell.chooseDirectory({
      title: "选择下载保存目录",
      defaultPath: desktopPreferences.value.downloadsDir || appInfo.value.storage?.exports || "",
    }).catch(() => "");
    if (!folder) return;
    await persistDesktopPreferences({
      ...desktopPreferences.value,
      downloadsDir: folder,
    });
  }

  async function openDownloadDirectory() {
    const folder = desktopPreferences.value.downloadsDir || appInfo.value.storage?.exports || "";
    if (!folder || typeof window.desktopShell?.openStoragePath !== "function") return;
    await window.desktopShell.openStoragePath(folder).catch(() => {});
  }

  async function clearDesktopCache() {
    if (typeof window.desktopShell?.clearCache !== "function") return;
    const payload = await window.desktopShell.clearCache().catch(() => null);
    if (payload?.storage) appInfo.value = { ...appInfo.value, storage: payload.storage };
    const files = Number(payload?.summary?.files || 0);
    const bytes = Number(payload?.summary?.bytes || 0);
    store.pushNotification({
      title: "缓存已清理",
      message: `已清理 ${files} 个缓存文件 · ${Math.round(bytes / 1024)} KB`,
      tone: "success",
      ttl: 2600,
    });
  }

  return {
    chooseDownloadDirectory,
    clearDesktopCache,
    openDownloadDirectory,
  };
}

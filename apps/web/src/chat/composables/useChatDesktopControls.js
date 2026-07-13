import { ref } from "vue";
import { applyAppearanceMode } from "../../shared/appearance-mode.js";
import { chatApi } from "../../shared/api-client.js";
import { loadAppSettings, saveAppSettings } from "../../shared/app-settings.js";
import { mergeDesktopPreferences } from "../../shared/desktop-preferences.js";

export function useChatDesktopControls({ store, actions }) {
  const settingsOpen = ref(false);
  const appSettings = ref(loadAppSettings());
  const desktopPreferences = ref(mergeDesktopPreferences());
  const updatePromptOpen = ref(false);
  const appInfo = ref({
    productName: "Linksee Chat",
    version: "",
    electron: window.desktopShell?.versions?.electron || "",
    chrome: window.desktopShell?.versions?.chrome || "",
    node: window.desktopShell?.versions?.node || "",
    storage: null,
  });

  function syncAppearance() {
    applyAppearanceMode(appSettings.value.appearance?.themeMode || "system");
  }

  function updateReminderKey(version) {
    return `linksee_update_remind_after_${String(version || "latest")}`;
  }

  function shouldShowUpdatePrompt(update) {
    if (!update?.hasUpdate) return false;
    if (update.mandatory) return true;
    const remindAfter = Number(window.localStorage.getItem(updateReminderKey(update.latestVersion)) || 0);
    return Date.now() >= remindAfter;
  }

  function applyDesktopUpdateState(state = {}) {
    const update = {
      native: true,
      hasUpdate: Boolean(state.available),
      latestVersion: state.version || "",
      mandatory: false,
      downloaded: Boolean(state.downloaded),
      progress: Number(state.progress || 0),
      status: state.status || "idle",
      error: state.error || "",
    };
    appInfo.value = { ...appInfo.value, update };
    updatePromptOpen.value = shouldShowUpdatePrompt(update);
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

  function closeUpdatePrompt() {
    updatePromptOpen.value = false;
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

  async function checkForUpdates() {
    const currentVersion = appInfo.value.version || "";
    if (!currentVersion) return;
    if (typeof window.desktopShell?.checkForUpdates === "function") {
      const state = await window.desktopShell.checkForUpdates().catch((error) => ({
        status: "error",
        error: error?.message || "检查更新失败",
      }));
      applyDesktopUpdateState(state);
      return;
    }
    const payload = await chatApi.getJson(`/api/v1/updates/latest?currentVersion=${encodeURIComponent(currentVersion)}`).catch(() => null);
    if (payload?.data) {
      appInfo.value = { ...appInfo.value, update: payload.data };
      updatePromptOpen.value = shouldShowUpdatePrompt(payload.data);
    }
  }

  async function handleUpdateNow() {
    const update = appInfo.value.update || {};
    if (update.native && typeof window.desktopShell?.downloadUpdate === "function") {
      if (update.downloaded && typeof window.desktopShell?.installUpdate === "function") {
        await window.desktopShell.installUpdate();
        return;
      }
      updatePromptOpen.value = true;
      const state = await window.desktopShell.downloadUpdate().catch((error) => ({
        ...update,
        status: "error",
        error: error?.message || "下载更新失败",
      }));
      applyDesktopUpdateState(state);
      return;
    }
    appInfo.value = {
      ...appInfo.value,
      update: {
        ...update,
        status: "error",
        error: "当前客户端不支持自动更新，请安装正式桌面版后重试",
      },
    };
    updatePromptOpen.value = true;
  }

  function remindUpdateLater() {
    const update = appInfo.value.update || {};
    const remindAfter = Date.now() + 6 * 60 * 60 * 1000;
    window.localStorage.setItem(updateReminderKey(update.latestVersion), String(remindAfter));
    updatePromptOpen.value = false;
  }

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

  function handleAvatarUpload(event) {
    const file = event.target?.files?.[0];
    actions.uploadAvatar(file).catch((error) => {
      store.profileHint.value = error?.message || "头像上传失败";
      store.profileHintTone.value = "error";
    });
  }

  return {
    appInfo,
    appSettings,
    applyDesktopPreferenceState,
    applyDesktopUpdateState,
    checkForUpdates,
    chooseDownloadDirectory,
    clearDesktopCache,
    closeSettings,
    closeUpdatePrompt,
    desktopPreferences,
    handleAvatarUpload,
    handleUpdateNow,
    openDownloadDirectory,
    openSettings,
    persistDesktopPreferences,
    persistSettings,
    remindUpdateLater,
    settingsOpen,
    syncAppearance,
    updatePromptOpen,
  };
}

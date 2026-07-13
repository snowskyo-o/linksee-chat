import { ref } from "vue";
import { chatApi } from "../../shared/api-client.js";

export function useChatDesktopUpdateControls() {
  const updatePromptOpen = ref(false);
  const appInfo = ref({
    productName: "Linksee Chat",
    version: "",
    electron: window.desktopShell?.versions?.electron || "",
    chrome: window.desktopShell?.versions?.chrome || "",
    node: window.desktopShell?.versions?.node || "",
    storage: null,
  });

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

  function closeUpdatePrompt() {
    updatePromptOpen.value = false;
  }

  return {
    appInfo,
    applyDesktopUpdateState,
    checkForUpdates,
    closeUpdatePrompt,
    handleUpdateNow,
    remindUpdateLater,
    updatePromptOpen,
  };
}

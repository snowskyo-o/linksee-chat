import { ref } from "vue";
import { chatApi } from "../../shared/api-client.js";
import { remindUpdateLater, shouldShowUpdatePrompt } from "./chat-desktop-update-policy.js";
import { createInitialAppInfo, normalizeDesktopUpdateState } from "./chat-desktop-update-state.js";

export function useChatDesktopUpdateControls() {
  const updatePromptOpen = ref(false);
  const appInfo = ref(createInitialAppInfo());

  function applyDesktopUpdateState(state = {}) {
    const update = normalizeDesktopUpdateState(state);
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

  function closeUpdatePrompt() {
    updatePromptOpen.value = false;
  }

  return {
    appInfo,
    applyDesktopUpdateState,
    checkForUpdates,
    closeUpdatePrompt,
    handleUpdateNow,
    remindUpdateLater: () => remindUpdateLater(appInfo, updatePromptOpen),
    updatePromptOpen,
  };
}

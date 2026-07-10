import { onBeforeUnmount, onMounted, ref } from "vue";

export function useDesktopShell() {
  const isDesktop = Boolean(window.desktopShell?.isDesktop);
  const isMaximized = ref(false);

  let detach = null;

  async function syncWindowState() {
    if (!isDesktop || typeof window.desktopShell?.getWindowState !== "function") return;
    const state = await window.desktopShell.getWindowState().catch(() => ({}));
    isMaximized.value = Boolean(state?.isMaximized);
  }

  function minimizeWindow() {
    return window.desktopShell?.minimize?.();
  }

  function toggleMaximizeWindow() {
    return window.desktopShell?.toggleMaximize?.();
  }

  function closeWindow() {
    return window.desktopShell?.close?.();
  }

  onMounted(() => {
    if (!isDesktop) return;
    syncWindowState();
    detach = window.desktopShell?.onWindowState?.((state) => {
      isMaximized.value = Boolean(state?.isMaximized);
    }) || null;
  });

  onBeforeUnmount(() => {
    if (typeof detach === "function") {
      detach();
    }
  });

  return {
    isDesktop,
    isMaximized,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
  };
}

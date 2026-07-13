import { ref } from "vue";

export function useStickerLibrary() {
  const stickers = ref([]);
  const loading = ref(false);
  const hint = ref("");
  const hintTone = ref("");
  const isDesktop = Boolean(window.desktopShell?.isDesktop);

  async function refresh() {
    if (!isDesktop || typeof window.desktopShell?.listStickers !== "function") return [];
    loading.value = true;
    try {
      const next = await window.desktopShell.listStickers();
      stickers.value = Array.isArray(next) ? next : [];
      return stickers.value;
    } catch (error) {
      hint.value = error?.message || "读取表情包失败";
      hintTone.value = "error";
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function importFiles() {
    if (!isDesktop || typeof window.desktopShell?.importStickerFiles !== "function") return;
    loading.value = true;
    try {
      const next = await window.desktopShell.importStickerFiles();
      stickers.value = Array.isArray(next) ? next : [];
      hint.value = stickers.value.length ? "表情已导入本地库" : "";
      hintTone.value = stickers.value.length ? "success" : "";
    } catch (error) {
      hint.value = error?.message || "导入表情失败";
      hintTone.value = "error";
    } finally {
      loading.value = false;
    }
  }

  async function importFolder() {
    if (!isDesktop || typeof window.desktopShell?.importStickerFolder !== "function") return;
    loading.value = true;
    try {
      const next = await window.desktopShell.importStickerFolder();
      stickers.value = Array.isArray(next) ? next : [];
      hint.value = stickers.value.length ? "文件夹表情已导入" : "";
      hintTone.value = stickers.value.length ? "success" : "";
    } catch (error) {
      hint.value = error?.message || "导入文件夹失败";
      hintTone.value = "error";
    } finally {
      loading.value = false;
    }
  }

  function clearHint() {
    hint.value = "";
    hintTone.value = "";
  }

  return {
    isDesktop,
    stickers,
    loading,
    hint,
    hintTone,
    refresh,
    importFiles,
    importFolder,
    clearHint,
  };
}

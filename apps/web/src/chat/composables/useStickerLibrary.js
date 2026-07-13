import { computed, ref } from "vue";

const RECENT_STICKERS_KEY = "linksee_chat_recent_stickers";
const RECENT_STICKER_LIMIT = 18;

function loadRecentStickerIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_STICKERS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).map((item) => String(item)).slice(0, RECENT_STICKER_LIMIT) : [];
  } catch {
    return [];
  }
}

export function useStickerLibrary() {
  const stickers = ref([]);
  const loading = ref(false);
  const hint = ref("");
  const hintTone = ref("");
  const isDesktop = Boolean(window.desktopShell?.isDesktop);
  const recentStickerIds = ref(loadRecentStickerIds());

  const recentStickers = computed(() => recentStickerIds.value
    .map((id) => stickers.value.find((item) => String(item.id) === id))
    .filter(Boolean));

  const libraryStickers = computed(() => stickers.value.filter((item) => !recentStickerIds.value.includes(String(item.id))));

  function persistRecentStickerIds(nextIds) {
    recentStickerIds.value = nextIds.slice(0, RECENT_STICKER_LIMIT);
    window.localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(recentStickerIds.value));
  }

  function syncRecentStickers(nextStickers) {
    const validIds = new Set((Array.isArray(nextStickers) ? nextStickers : []).map((item) => String(item.id)));
    persistRecentStickerIds(recentStickerIds.value.filter((id) => validIds.has(String(id))));
  }

  async function refresh() {
    if (!isDesktop || typeof window.desktopShell?.listStickers !== "function") return [];
    loading.value = true;
    try {
      const next = await window.desktopShell.listStickers();
      stickers.value = Array.isArray(next) ? next : [];
      syncRecentStickers(stickers.value);
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
      syncRecentStickers(stickers.value);
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
      syncRecentStickers(stickers.value);
      hint.value = stickers.value.length ? "文件夹表情已导入" : "";
      hintTone.value = stickers.value.length ? "success" : "";
    } catch (error) {
      hint.value = error?.message || "导入文件夹失败";
      hintTone.value = "error";
    } finally {
      loading.value = false;
    }
  }

  async function rename(stickerId, name) {
    if (!isDesktop || typeof window.desktopShell?.renameSticker !== "function") return;
    loading.value = true;
    try {
      const next = await window.desktopShell.renameSticker({ id: stickerId, name });
      stickers.value = Array.isArray(next) ? next : [];
      syncRecentStickers(stickers.value);
      hint.value = "表情名称已更新";
      hintTone.value = "success";
    } catch (error) {
      hint.value = error?.message || "修改名称失败";
      hintTone.value = "error";
    } finally {
      loading.value = false;
    }
  }

  async function remove(stickerId) {
    if (!isDesktop || typeof window.desktopShell?.deleteSticker !== "function") return;
    loading.value = true;
    try {
      const next = await window.desktopShell.deleteSticker(stickerId);
      stickers.value = Array.isArray(next) ? next : [];
      syncRecentStickers(stickers.value);
      hint.value = "表情已删除";
      hintTone.value = "success";
    } catch (error) {
      hint.value = error?.message || "删除表情失败";
      hintTone.value = "error";
    } finally {
      loading.value = false;
    }
  }

  async function move(stickerId, direction) {
    if (!isDesktop || typeof window.desktopShell?.moveSticker !== "function") return;
    loading.value = true;
    try {
      const next = await window.desktopShell.moveSticker({ id: stickerId, direction });
      stickers.value = Array.isArray(next) ? next : [];
      syncRecentStickers(stickers.value);
      hint.value = "表情顺序已更新";
      hintTone.value = "success";
    } catch (error) {
      hint.value = error?.message || "调整顺序失败";
      hintTone.value = "error";
    } finally {
      loading.value = false;
    }
  }

  function clearHint() {
    hint.value = "";
    hintTone.value = "";
  }

  function markUsed(sticker) {
    const stickerId = String(sticker?.id || "").trim();
    if (!stickerId) return;
    persistRecentStickerIds([stickerId, ...recentStickerIds.value.filter((id) => id !== stickerId)]);
  }

  function clearRecent() {
    persistRecentStickerIds([]);
  }

  return {
    isDesktop,
    stickers,
    recentStickers,
    libraryStickers,
    loading,
    hint,
    hintTone,
    refresh,
    importFiles,
    importFolder,
    rename,
    remove,
    move,
    clearHint,
    markUsed,
    clearRecent,
  };
}

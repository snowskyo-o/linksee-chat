import { computed, ref } from "vue";
import { createRecentStickerState } from "./sticker-library-recent.js";
import { createStickerLibraryOperations } from "./sticker-library-operations.js";

export function useStickerLibrary() {
  const stickers = ref([]);
  const loading = ref(false);
  const hint = ref("");
  const hintTone = ref("");
  const isDesktop = Boolean(window.desktopShell?.isDesktop);
  const recentStickerIds = ref([]);
  const recentState = createRecentStickerState(recentStickerIds);
  const operations = createStickerLibraryOperations({
    isDesktop,
    stickers,
    loading,
    hint,
    hintTone,
    syncRecentStickers: recentState.syncRecentStickers,
  });
  recentStickerIds.value = recentState.loadRecentStickerIds();

  const recentStickers = computed(() => recentStickerIds.value
    .map((id) => stickers.value.find((item) => String(item.id) === id))
    .filter(Boolean));

  const libraryStickers = computed(() => stickers.value.filter((item) => !recentStickerIds.value.includes(String(item.id))));

  function clearHint() {
    hint.value = "";
    hintTone.value = "";
  }

  return {
    isDesktop,
    stickers,
    recentStickers,
    libraryStickers,
    loading,
    hint,
    hintTone,
    refresh: operations.refresh,
    importFiles: operations.importFiles,
    importFolder: operations.importFolder,
    rename: operations.rename,
    remove: operations.remove,
    move: operations.move,
    clearHint,
    markUsed: recentState.markUsed,
    clearRecent: recentState.clearRecent,
  };
}

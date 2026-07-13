const RECENT_STICKERS_KEY = "linksee_chat_recent_stickers";
const RECENT_STICKER_LIMIT = 18;

function loadRecentStickerIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_STICKERS_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(Boolean).map((item) => String(item)).slice(0, RECENT_STICKER_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function createRecentStickerState(recentStickerIds) {
  function persistRecentStickerIds(nextIds) {
    recentStickerIds.value = nextIds.slice(0, RECENT_STICKER_LIMIT);
    window.localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(recentStickerIds.value));
  }

  function syncRecentStickers(nextStickers) {
    const validIds = new Set((Array.isArray(nextStickers) ? nextStickers : []).map((item) => String(item.id)));
    persistRecentStickerIds(recentStickerIds.value.filter((id) => validIds.has(String(id))));
  }

  function markUsed(sticker) {
    const stickerId = String(sticker?.id || "").trim();
    if (!stickerId) return;
    persistRecentStickerIds([stickerId, ...recentStickerIds.value.filter((id) => id !== stickerId)]);
  }

  return {
    loadRecentStickerIds,
    persistRecentStickerIds,
    syncRecentStickers,
    markUsed,
    clearRecent: () => persistRecentStickerIds([]),
  };
}

function resolveDesktopShellMethod(methodName) {
  return typeof window.desktopShell?.[methodName] === "function"
    ? window.desktopShell[methodName]
    : null;
}

export function createStickerLibraryOperations({
  isDesktop,
  stickers,
  loading,
  hint,
  hintTone,
  syncRecentStickers,
}) {
  function resolveSuccessMessage(successMessage, nextStickers) {
    return typeof successMessage === "function"
      ? successMessage(nextStickers)
      : successMessage || "";
  }

  function applyStickers(next, successMessage = "") {
    stickers.value = Array.isArray(next) ? next : [];
    syncRecentStickers(stickers.value);
    hint.value = resolveSuccessMessage(successMessage, stickers.value);
    hintTone.value = hint.value ? "success" : "";
    return stickers.value;
  }

  async function runOperation(methodName, payload, successMessage, fallbackError) {
    const handler = resolveDesktopShellMethod(methodName);
    if (!isDesktop || !handler) return [];
    loading.value = true;
    try {
      const next = payload === undefined ? await handler() : await handler(payload);
      return applyStickers(next, successMessage);
    } catch (error) {
      hint.value = error?.message || fallbackError;
      hintTone.value = "error";
      return [];
    } finally {
      loading.value = false;
    }
  }

  return {
    refresh: () => runOperation("listStickers", undefined, "", "读取表情包失败"),
    importFiles: () => runOperation("importStickerFiles", undefined, (next) => (next.length ? "表情已导入本地库" : ""), "导入表情失败"),
    importFolder: () => runOperation("importStickerFolder", undefined, (next) => (next.length ? "文件夹表情已导入" : ""), "导入文件夹失败"),
    rename: (stickerId, name) => runOperation("renameSticker", { id: stickerId, name }, "表情名称已更新", "修改名称失败"),
    remove: (stickerId) => runOperation("deleteSticker", stickerId, "表情已删除", "删除表情失败"),
    move: (stickerId, direction) => runOperation("moveSticker", { id: stickerId, direction }, "表情顺序已更新", "调整顺序失败"),
  };
}

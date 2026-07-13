import { CHAT_FILE_MAX_BYTES, validateChatFile } from "./chat-file-policy.js";
import { createPendingAttachment, dedupeFileList } from "./file-attachments.js";

export function createChatAttachmentQueueActions(store) {
  function queueFiles(fileList, options = {}) {
    if (!store.selectedId.value) {
      store.setComposerHint("请先选择一个会话，再添加附件", "error");
      return;
    }
    const existing = new Set(store.pendingFiles.value.map((item) => (
      [item.name || "", item.size || 0, item.file?.lastModified || 0].join(":")
    )));
    const result = {
      added: [],
      duplicates: 0,
      tooLarge: 0,
      unsupportedType: 0,
      empty: 0,
      directoryLike: Number(options.directoryLike || 0),
      ignoredClipboardFiles: Number(options.ignoredClipboardFiles || 0),
    };
    dedupeFileList(fileList).forEach((file) => {
      const key = [file.name || "", file.size || 0, file.lastModified || 0].join(":");
      if (existing.has(key)) {
        result.duplicates += 1;
        return;
      }
      const validation = validateChatFile(file);
      if (!validation.ok) {
        if (validation.reason === "tooLarge") result.tooLarge += 1;
        else if (validation.reason === "unsupportedType") result.unsupportedType += 1;
        else result.empty += 1;
        return;
      }
      result.added.push(createPendingAttachment(file));
    });
    if (!result.added.length) {
      if (result.directoryLike) {
        store.setComposerHint("暂不支持拖入文件夹，请选择具体文件", "error");
        return;
      }
      if (result.tooLarge) {
        store.setComposerHint(`单个文件不能超过 ${Math.round(CHAT_FILE_MAX_BYTES / 1024 / 1024)} MB`, "error");
        return;
      }
      if (result.unsupportedType) {
        store.setComposerHint("包含暂不支持的文件类型，请重新选择", "error");
        return;
      }
      if (options.source === "paste" && result.ignoredClipboardFiles) {
        store.setComposerHint("当前只支持粘贴图片，其他剪贴板文件已忽略", "error");
        return;
      }
      if (result.duplicates) {
        store.setComposerHint("这些附件已经在待发送列表中了", "error");
      }
      return;
    }
    store.pendingFiles.value = [...store.pendingFiles.value, ...result.added];
    const hintParts = [`${store.pendingFiles.value.length} 个文件待发送`];
    if (result.duplicates) hintParts.push(`已跳过 ${result.duplicates} 个重复项`);
    if (result.directoryLike) hintParts.push(`已忽略 ${result.directoryLike} 个文件夹`);
    if (result.tooLarge) hintParts.push(`已忽略 ${result.tooLarge} 个超大文件`);
    if (result.unsupportedType) hintParts.push(`已忽略 ${result.unsupportedType} 个不支持类型`);
    if (options.source === "paste" && result.ignoredClipboardFiles) hintParts.push(`已忽略 ${result.ignoredClipboardFiles} 个非图片项`);
    store.setComposerHint(hintParts.join(" · "), "success");
  }

  return { queueFiles };
}

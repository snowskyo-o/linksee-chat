import { chatApi } from "../../shared/api-client.js";
import { isImageFileLike } from "./file-attachments.js";

export function createChatFileDownloadClipboard({ store }) {
  async function copyImageToClipboard(file) {
    if (!file?.objectKey || !isImageFileLike(file)) {
      store.setComposerHint("当前附件不是可复制的图片", "error");
      return;
    }
    const blob = await chatApi.getBlob(`/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`);
    if (typeof window.desktopShell?.writeImageToClipboard === "function") {
      await window.desktopShell.writeImageToClipboard({
        fileName: file.name || "image.png",
        mimeType: file.mimeType || blob.type || "image/png",
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      });
      store.setComposerHint("图片已复制到剪贴板", "success");
      return;
    }
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type || "image/png"]: blob })]);
      store.setComposerHint("图片已复制到剪贴板", "success");
      return;
    }
    throw new Error("当前环境不支持复制图片");
  }

  return {
    copyImageToClipboard,
  };
}

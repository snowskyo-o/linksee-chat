export function createChatFileDownloadOpenActions({ store, downloadFile }) {
  async function autoReceiveImages(files = [], autoReceiveQueue) {
    const targets = files.filter((file) => (
      file?.isImage
      && file?.objectKey
      && !file?.expired
      && !autoReceiveQueue.has(String(file.objectKey))
      && !["saved", "saving", "downloading"].includes(String(file?.transfer?.status || ""))
    ));
    for (const file of targets) {
      const objectKey = String(file.objectKey);
      autoReceiveQueue.add(objectKey);
      try {
        await downloadFile(file, { silent: true });
      } catch {
      } finally {
        autoReceiveQueue.delete(objectKey);
      }
    }
  }

  async function openFileLocation(file) {
    const targetPath = String(file?.transfer?.path || "").trim();
    if (!targetPath) {
      store.setComposerHint("该文件还没有本地保存记录", "error");
      return;
    }
    if (typeof window.desktopShell?.openStoragePath !== "function") {
      store.setComposerHint("当前环境不支持打开文件位置", "error");
      return;
    }
    await window.desktopShell.openStoragePath(targetPath);
  }

  async function openFile(file) {
    const targetPath = String(file?.transfer?.path || "").trim();
    if (targetPath && typeof window.desktopShell?.openFile === "function") {
      const opened = await window.desktopShell.openFile(targetPath);
      if (!opened) throw new Error("文件打开失败");
      return;
    }
    await downloadFile(file, { openAfterSave: true });
  }

  async function saveFileAs(file) {
    await downloadFile(file, { mode: "saveAs" });
  }

  return {
    autoReceiveImages,
    openFile,
    openFileLocation,
    saveFileAs,
  };
}

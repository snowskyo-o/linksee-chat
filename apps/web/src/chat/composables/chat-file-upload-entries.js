import { dedupeFileList } from "./file-attachments.js";

function matchPendingItem(pendingItems, file) {
  return pendingItems.find((item) => item.file === file)
    || pendingItems.find((item) => (
      [item.file?.name || "", item.file?.size || 0, item.file?.lastModified || 0].join(":")
        === [file.name || "", file.size || 0, file.lastModified || 0].join(":")
    ));
}

export function normalizeUploadEntries(fileList) {
  const rawItems = Array.from(fileList || []).filter(Boolean);
  const pendingItems = rawItems.filter((item) => item?.file);
  const files = pendingItems.length ? pendingItems.map((item) => item.file) : rawItems;
  return dedupeFileList(files).map((file) => ({
    file,
    pendingItem: matchPendingItem(pendingItems, file),
  }));
}

export function updatePendingUploads(store, pendingIds, patch) {
  pendingIds.forEach((id) => store.updatePendingFile(id, patch));
}

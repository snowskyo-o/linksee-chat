export function enrichChatFilesForResponse(files, fileRows = []) {
  if (!Array.isArray(files)) return [];
  const rowMap = new Map(fileRows.map((row) => [row.objectKey, row]));
  return files.map((file) => {
    const row = rowMap.get(file.objectKey);
    const expiresAt = row?.expiresAt ? new Date(row.expiresAt).toISOString() : file.expiresAt;
    const expired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
    return {
      name: file.name || "附件",
      objectKey: file.objectKey || "",
      size: Number(file.size || 0),
      mimeType: file.mimeType || "application/octet-stream",
      uploadedAt: file.uploadedAt || new Date().toISOString(),
      expiresAt,
      expired,
      downloadPath: expired ? "" : `/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`,
    };
  });
}

export function handleComposerPaste(event, emit) {
  const clipboardFiles = Array.from(event.clipboardData?.files || []);
  const files = clipboardFiles.filter((file) => String(file.type || "").startsWith("image/"));
  if (!files.length) return void (clipboardFiles.length ? event.preventDefault() : undefined);
  event.preventDefault();
  emit("file-paste", { files, ignoredClipboardFiles: Math.max(0, clipboardFiles.length - files.length) });
}

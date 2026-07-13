export function formatChatTitle(chatTitle = "", chatKind = "", participantCount = 0) {
  const title = String(chatTitle || "").trim();
  if (!title) return "";
  if (chatKind !== "group") return title;
  const count = Number(participantCount || 0);
  return count > 0 ? `${title}（${count}）` : title;
}

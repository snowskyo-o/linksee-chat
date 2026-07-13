import { escapeHtml } from "../../shared/utils.js";

export function escapeDerivedSearchPattern(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildDerivedConversationTitle(row, authUserId) {
  if (!row) return "未命名会话";
  if (row.title) return row.title;
  if (row.kind === "direct") {
    const peer = (row.participants || []).find((item) => item.id !== authUserId);
    return peer?.profile?.realName || peer?.id || "单聊";
  }
  return "群聊";
}

export function buildDerivedConversationSubtitle(row, authUserId) {
  if (!row) return "";
  if (row.kind === "direct") {
    const peer = (row.participants || []).find((item) => item.id !== authUserId);
    const originalName = peer?.profile?.originalRealName || "";
    const bio = peer?.profile?.bio || "";
    if (peer?.friendAlias && originalName && originalName !== peer.friendAlias) {
      return bio ? `${originalName} · ${bio}` : originalName;
    }
    return bio || "私聊";
  }
  const count = Array.isArray(row.participants) ? row.participants.length : 0;
  return count > 0 ? `${count} 位成员` : "群聊";
}

export function buildDerivedConversationPreview(row, authUserId = "") {
  if (!row?.lastMessage) return "还没有消息";
  const preview = buildDerivedMessagePreview(row.lastMessage);
  if (row.kind !== "group" || row.lastMessage.deletedAt || row.lastMessage.type === "announcement") return preview;
  const senderName = resolveMessageSenderName(row.lastMessage, authUserId);
  return senderName ? `${senderName}：${preview}` : preview;
}

export function buildDerivedMessagePreview(message, authUserId = "") {
  if (!message) return "还没有消息";
  if (message.deletedAt) return "消息已撤回";
  if (message.type === "announcement") return `【公告】${message.content || ""}`;
  if (message.type === "file") return message.content || "[文件]";
  return message.content || "[空消息]";
}

function resolveMessageSenderName(message, authUserId) {
  if (String(message?.senderId || "") === String(authUserId || "")) return "你";
  return message?.sender?.profile?.realName || message?.senderId || "";
}

export function buildDerivedReplyText(message) {
  return buildReplyPreviewText(message?.replyTo);
}

export function buildReplyPreviewText(replyTo) {
  if (!replyTo) return "";
  const replySenderName = replyTo.sender?.profile?.realName || replyTo.senderId || "对方";
  const replyContent = replyTo.content
    || (Array.isArray(replyTo.files) && replyTo.files.length
      ? replyTo.files.map((file) => file.name || "附件").join("、")
      : "");
  return `回复 ${replySenderName}：${replyContent}`;
}

export function highlightMentionTokens(html, participants) {
  let nextHtml = html;
  participants.forEach((user) => {
    const name = user.profile?.realName || "";
    if (!name) return;
    const token = `@${name}`;
    nextHtml = nextHtml.split(escapeHtml(token)).join(`<span class="mention">${escapeHtml(token)}</span>`);
  });
  return nextHtml;
}

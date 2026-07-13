export function isMessageActionAvailable(message, action) {
  if (!message || !action) return false;
  if (action === "copy") return Boolean(message.canCopy);
  if (action === "reply") return !message.deletedAt && !message.operationState;
  if (action === "forward") return Boolean(message.canForward);
  if (action === "favorite") return !message.deletedAt && !message.operationState;
  if (action === "recall") return Boolean(message.canRecall);
  if (action === "delete") return Boolean(message.canDelete);
  if (action === "retry") return Boolean(message.canRetry);
  return false;
}

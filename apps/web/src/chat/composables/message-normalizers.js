import { resolveMediaUrl } from "../../shared/media.js";

export function normalizeUser(user) {
  return {
    ...user,
    profile: {
      ...(user?.profile || {}),
      avatarUrl: resolveMediaUrl(user?.profile?.avatarUrl || ""),
    },
  };
}

export function normalizeMessage(message) {
  if (!message) return message;
  return {
    ...message,
    operationState: message.operationState || "",
    sendError: message.sendError || "",
    sender: message.sender ? normalizeUser(message.sender) : message.sender,
    replyTo: message.replyTo
      ? {
          ...message.replyTo,
          sender: message.replyTo.sender ? normalizeUser(message.replyTo.sender) : message.replyTo.sender,
        }
      : message.replyTo,
  };
}

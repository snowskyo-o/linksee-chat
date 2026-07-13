import { mergeUserProfile, mergeUsersById } from "./chat-profile-merge.js";

function mergeMessageUser(cachedUser, serverUser) {
  if (!cachedUser && !serverUser) return serverUser || cachedUser || null;
  return mergeUserProfile(cachedUser, serverUser, serverUser?.id || cachedUser?.id || "");
}

export function mergeMessagesById(cachedMessages = [], serverMessages = []) {
  const cachedMap = new Map((Array.isArray(cachedMessages) ? cachedMessages : []).map((message) => [String(message?.id || ""), message]));
  return (Array.isArray(serverMessages) ? serverMessages : []).map((message) => {
    const cachedMessage = cachedMap.get(String(message?.id || ""));
    return {
      ...(cachedMessage || {}),
      ...(message || {}),
      sender: mergeMessageUser(cachedMessage?.sender, message?.sender),
      replyTo: message?.replyTo || cachedMessage?.replyTo
        ? {
            ...(cachedMessage?.replyTo || {}),
            ...(message?.replyTo || {}),
            sender: mergeMessageUser(cachedMessage?.replyTo?.sender, message?.replyTo?.sender),
          }
        : null,
    };
  });
}

export function mergeConversationsById(cachedRows = [], serverRows = []) {
  const cachedMap = new Map((Array.isArray(cachedRows) ? cachedRows : []).map((row) => [String(row?.id || ""), row]));
  return (Array.isArray(serverRows) ? serverRows : []).map((row) => {
    const cachedRow = cachedMap.get(String(row?.id || ""));
    return {
      ...(cachedRow || {}),
      ...(row || {}),
      participants: mergeUsersById(cachedRow?.participants, row?.participants),
      lastMessage: row?.lastMessage || cachedRow?.lastMessage
        ? {
            ...(cachedRow?.lastMessage || {}),
            ...(row?.lastMessage || {}),
            sender: mergeMessageUser(cachedRow?.lastMessage?.sender, row?.lastMessage?.sender),
          }
        : null,
    };
  });
}

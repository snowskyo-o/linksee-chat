export function paneCountText(activePane, conversationCount, contactCount, favoriteCount) {
  if (activePane === "messages") return `${conversationCount} 个会话`;
  if (activePane === "contacts") return `${contactCount} 位联系人`;
  return `${favoriteCount} 条收藏`;
}

export function panePlaceholder(activePane) {
  if (activePane === "messages") return "搜索会话、联系人、消息";
  if (activePane === "contacts") return "搜索联系人";
  return "搜索收藏消息";
}

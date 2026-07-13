export const conversationSidebarProps = {
  meName: { type: String, default: "未登录" },
  meMeta: { type: String, default: "" },
  meAvatar: { type: String, default: "ME" },
  meAvatarUrl: { type: String, default: "" },
  keyword: { type: String, default: "" },
  conversations: { type: Array, default: () => [] },
  selectedId: { type: String, default: "" },
  listOnly: { type: Boolean, default: false },
  loadState: { type: Object, default: () => ({ status: "idle", message: "" }) },
};

export const conversationSidebarEmits = [
  "update:keyword",
  "select",
  "open",
  "refresh",
  "new-direct",
  "new-group",
  "open-settings",
  "logout",
  "toggle-pin",
  "retry-load",
];

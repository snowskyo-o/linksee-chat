export const conversationListOverviewProps = {
  activePane: { type: String, default: "messages" },
  contactCount: { type: Number, default: 0 },
  conversationCount: { type: Number, default: 0 },
  favoriteCount: { type: Number, default: 0 },
  friendRequestTotal: { type: Number, default: 0 },
  keyword: { type: String, default: "" },
  meName: { type: String, default: "未登录" },
  quickCreateOpen: { type: Boolean, default: false },
  searchActiveKey: { type: String, default: "" },
  searchFocused: { type: Boolean, default: false },
  searchKeyword: { type: String, default: "" },
  searchPanelOpen: { type: Boolean, default: false },
  recentKeywords: { type: Array, default: () => [] },
  searchSections: { type: Array, default: () => [] },
  shell: { type: Object, required: true },
};

export const conversationListOverviewEmits = [
  "update:keyword", "open-direct", "open-group", "toggle-quick-create", "focus-search",
  "search-keydown", "clear-search", "search-pick", "clear-recent", "recent-pick",
  "search-footer-pick", "open-settings",
];

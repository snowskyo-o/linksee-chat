export const listSearchPanelProps = {
  open: { type: Boolean, default: false },
  keyword: { type: String, default: "" },
  recentKeywords: { type: Array, default: () => [] },
  sections: { type: Array, default: () => [] },
  activeKey: { type: String, default: "" },
};

export const listSearchPanelEmits = [
  "pick", "clear-recent", "recent-pick", "footer-pick",
];

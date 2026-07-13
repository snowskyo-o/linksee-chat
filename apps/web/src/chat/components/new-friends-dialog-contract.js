export const newFriendsDialogProps = {
  open: { type: Boolean, default: false },
  keyword: { type: String, default: "" },
  loading: { type: Boolean, default: false },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
  recentContacts: { type: Array, default: () => [] },
  incomingRequests: { type: Array, default: () => [] },
  outgoingRequests: { type: Array, default: () => [] },
  recommendedUsers: { type: Array, default: () => [] },
  friendContacts: { type: Array, default: () => [] },
};

export const newFriendsDialogEmits = [
  "close",
  "update:keyword",
  "start-chat",
  "send-request",
  "accept-request",
  "reject-request",
  "cancel-request",
  "edit-friend",
  "remove-friend",
];

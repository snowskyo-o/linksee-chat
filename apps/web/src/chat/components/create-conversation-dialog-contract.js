export const createConversationDialogProps = {
  open: { type: Boolean, default: false },
  mode: { type: String, default: "direct" },
  title: { type: String, default: "" },
  peerId: { type: String, default: "" },
  participantIds: { type: Array, default: () => [] },
  contacts: { type: Array, default: () => [] },
  selectedParticipants: { type: Array, default: () => [] },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
  submitting: { type: Boolean, default: false },
};

export const createConversationDialogEmits = ["close", "submit", "update:title", "update:peerId", "toggle-participant"];

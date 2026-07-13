import { chatAppDialogEmits, chatAppDialogProps } from "./chat-app-dialog-contract.js";

export const chatDialogProps = {
  ...chatAppDialogProps,
  actions: { type: Object, default: () => ({}) },
  groupManagement: { type: Object, default: () => ({}) },
  standaloneConversationMode: { type: Boolean, default: false },
};

export const chatDialogEmits = [...chatAppDialogEmits];

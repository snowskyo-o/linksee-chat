export const chatPageWorkspaceProps = {
  actions: { type: Object, required: true },
  auth: { type: Object, required: true },
  groupManagement: { type: Object, required: true },
  runtime: { type: Object, required: true },
  selectConversation: { type: Function, required: true },
  standaloneConversationMode: { type: Object, required: true },
  stickerLibrary: { type: Object, required: true },
  store: { type: Object, required: true },
};

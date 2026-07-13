import { createChatProfileDirtyActions } from "./chat-profile-dirty-actions.js";
import { createChatProfileSubmitActions } from "./chat-profile-submit-actions.js";

export function createChatProfileSyncActions({
  store,
  dataActions,
  chatApi,
  dirtyProfileUserIds,
  applyUserProfileUpdate,
  persistSidebarCaches,
  syncCurrentUserProfileLocally,
}) {
  return {
    ...createChatProfileDirtyActions({
      store,
      chatApi,
      dirtyProfileUserIds,
      applyUserProfileUpdate,
    }),
    ...createChatProfileSubmitActions({
      store,
      dataActions,
      chatApi,
      persistSidebarCaches,
      syncCurrentUserProfileLocally,
    }),
  };
}

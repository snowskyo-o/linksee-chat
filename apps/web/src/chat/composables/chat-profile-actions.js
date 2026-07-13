import { createChatProfileCacheActions } from "./chat-profile-cache-actions.js";
import { createChatProfileLocalActions } from "./chat-profile-local-actions.js";
import { createChatProfileSyncActions } from "./chat-profile-sync-actions.js";

export function createChatProfileActions({ store, dataActions, chatApi, cacheUserId, dirtyProfileUserIds }) {
  const cacheActions = createChatProfileCacheActions({ store, cacheUserId });
  const localActions = createChatProfileLocalActions({
    store,
    persistSidebarCaches: cacheActions.persistSidebarCaches,
  });
  const syncActions = createChatProfileSyncActions({
    store,
    dataActions,
    chatApi,
    dirtyProfileUserIds,
    applyUserProfileUpdate: localActions.applyUserProfileUpdate,
    persistSidebarCaches: cacheActions.persistSidebarCaches,
    syncCurrentUserProfileLocally: localActions.syncCurrentUserProfileLocally,
  });

  return {
    ...cacheActions,
    ...localActions,
    ...syncActions,
  };
}

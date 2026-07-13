import { createChatStoreDialogActions } from "./chat-store-dialog-actions.js";
import { createChatStorePendingActions } from "./chat-store-pending-actions.js";
import { createChatStorePreferenceActions } from "./chat-store-preference-actions.js";
import { createChatStoreUiActions } from "./chat-store-ui-actions.js";

export function createChatStoreActions(state, derived, saveFavoriteMessages) {
  const uiActions = createChatStoreUiActions(state, derived, saveFavoriteMessages);
  const dialogActions = createChatStoreDialogActions(
    state,
    uiActions.setCreateDialogHint,
    uiActions.setAnnouncementHint,
  );
  const preferenceActions = createChatStorePreferenceActions(state);
  const pendingActions = createChatStorePendingActions(state, uiActions.setComposerHint);

  return {
    ...uiActions,
    ...dialogActions,
    ...preferenceActions,
    ...pendingActions,
  };
}

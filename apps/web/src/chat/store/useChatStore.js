import { createChatStoreActions } from "./chat-store-actions.js";
import { createChatStoreDerived } from "./chat-store-derived.js";
import { saveFavoriteMessages } from "./chat-store-favorites.js";
import { createChatStoreState } from "./chat-store-state.js";

export function useChatStore(auth) {
  const state = createChatStoreState();
  const derived = createChatStoreDerived(auth, state);
  const actions = createChatStoreActions(state, derived, saveFavoriteMessages);

  return {
    ...state,
    ...derived,
    ...actions,
  };
}

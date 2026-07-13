import { useGroupInviteActions } from "./group-management-invite-actions.js";
import { useGroupMemberActions } from "./group-management-member-actions.js";

export function useGroupManagement(store, actions) {
  return {
    ...useGroupInviteActions(store, actions),
    ...useGroupMemberActions(store, actions),
  };
}

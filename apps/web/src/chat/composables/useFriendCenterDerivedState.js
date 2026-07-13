import { computed } from "vue";
import { normalizeFriendCenterPerson } from "./friend-center-utils.js";

function buildRowActionState(personId, requestId, isPending) {
  const targetPersonId = String(personId || "");
  const targetRequestId = String(requestId || "");
  return {
    canSendRequest: Boolean(targetPersonId) && !isPending(`send:${targetPersonId}`),
    canRemoveFriend: Boolean(targetPersonId) && !isPending(`remove:${targetPersonId}`),
    sendingRequest: Boolean(targetPersonId) && isPending(`send:${targetPersonId}`),
    removingFriend: Boolean(targetPersonId) && isPending(`remove:${targetPersonId}`),
    requestBusy: Boolean(targetRequestId) && isPending(`request:${targetRequestId}`),
  };
}

export function useFriendCenterDerivedState(store, state) {
  const contactMap = computed(() => new Map(
    store.createDialogContacts.value.map((contact) => [String(contact.id), contact]),
  ));

  const discoveryRows = computed(() => state.discovery.value.map((item) => {
    const person = normalizeFriendCenterPerson(item?.user);
    const fallbackContact = contactMap.value.get(person.id);
    const request = item?.request || null;
    return {
      id: person.id,
      name: fallbackContact?.name || person.name,
      originalName: fallbackContact?.realName || person.originalName,
      friendAlias: fallbackContact?.friendAlias || person.friendAlias,
      bio: fallbackContact?.bio || person.bio,
      avatarUrl: fallbackContact?.avatarUrl || person.avatarUrl,
      relation: item?.relation || "none",
      request,
      requestMessage: String(request?.message || "").trim(),
      ...buildRowActionState(person.id, request?.id, state.isPending),
    };
  }));

  const recentContacts = computed(() => {
    const usedTitles = new Set(
      store.conversationRows.value.filter((row) => row.kind === "direct").map((row) => row.displayTitle),
    );
    return discoveryRows.value.filter((row) => row.relation === "friend" && usedTitles.has(row.name)).slice(0, 4);
  });

  return {
    requestTotal: computed(() => state.requests.value.filter((item) => (
      item?.status === "pending" && item?.direction === "incoming"
    )).length),
    recentContacts,
    incomingRequests: computed(() => discoveryRows.value.filter((row) => row.relation === "incoming_pending")),
    outgoingRequests: computed(() => discoveryRows.value.filter((row) => row.relation === "outgoing_pending")),
    recommendedUsers: computed(() => discoveryRows.value.filter((row) => (
      row.relation === "none" || row.relation === "rejected" || row.relation === "canceled"
    ))),
    friendContacts: computed(() => discoveryRows.value.filter((row) => row.relation === "friend")),
  };
}

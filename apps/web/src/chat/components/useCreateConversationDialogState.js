import { computed, ref, watch } from "vue";

export function useCreateConversationDialogState(props) {
  const keyword = ref("");

  const filteredContacts = computed(() => {
    const search = keyword.value.trim().toLowerCase();
    if (!search) return props.contacts;
    return props.contacts.filter((contact) => [contact.name, contact.bio].some((value) => String(value || "").toLowerCase().includes(search)));
  });

  const selectionSummary = computed(() => {
    if (props.mode === "direct") return props.peerId ? "已选择 1 位联系人" : "请选择 1 位联系人";
    return props.participantIds.length ? `已选择 ${props.participantIds.length} 位成员` : "至少选择 2 位成员";
  });

  watch(
    () => props.open,
    (open) => {
      if (open) keyword.value = "";
    },
  );

  return { filteredContacts, keyword, selectionSummary };
}

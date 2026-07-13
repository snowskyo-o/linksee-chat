import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

export function useMessagePanelScroll(props, messageListViewportRef) {
  const pendingIncomingCount = ref(0);

  function getListElement() {
    return messageListViewportRef.value?.getListElement?.();
  }

  function getDistanceFromBottom() {
    const element = getListElement();
    if (!element) return 0;
    return Math.max(0, element.scrollHeight - element.scrollTop - element.clientHeight);
  }

  function isNearBottom() {
    return getDistanceFromBottom() <= 56;
  }

  function clearIncomingIndicator() {
    pendingIncomingCount.value = 0;
  }

  function scrollMessageListToBottom(behavior = "auto") {
    const element = getListElement();
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    clearIncomingIndicator();
  }

  function handleMessageListScroll() {
    if (isNearBottom()) clearIncomingIndicator();
  }

  onMounted(() => {
    nextTick(() => {
      scrollMessageListToBottom("auto");
      getListElement()?.addEventListener("scroll", handleMessageListScroll, { passive: true });
    });
  });

  watch(
    () => props.chatTitle,
    async () => {
      clearIncomingIndicator();
      await nextTick();
      scrollMessageListToBottom("auto");
    },
  );

  watch(
    () => props.messages[props.messages.length - 1]?.id || "",
    async (nextId, previousId) => {
      if (!nextId || nextId === previousId) return;
      const shouldAutoStick = isNearBottom();
      const latestMessage = props.messages[props.messages.length - 1];
      await nextTick();
      if (!previousId || latestMessage?.isMe || shouldAutoStick) {
        scrollMessageListToBottom(previousId ? "smooth" : "auto");
        return;
      }
      pendingIncomingCount.value += 1;
    },
  );

  onBeforeUnmount(() => {
    getListElement()?.removeEventListener("scroll", handleMessageListScroll);
  });

  return {
    pendingIncomingCount,
    scrollMessageListToBottom,
  };
}

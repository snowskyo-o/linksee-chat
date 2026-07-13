import { nextTick, ref, watch } from "vue";

export function useMessagePanelSearch(props, messageListViewportRef) {
  const searchMatchIndex = ref(-1);
  const searchMatches = ref([]);

  function collectSearchMatches() {
    const element = messageListViewportRef.value?.getListElement?.();
    if (!element) {
      searchMatches.value = [];
      searchMatchIndex.value = -1;
      return;
    }
    searchMatches.value = Array.from(element.querySelectorAll(".message-search-mark"));
    if (!searchMatches.value.length) {
      searchMatchIndex.value = -1;
      return;
    }
    if (searchMatchIndex.value < 0 || searchMatchIndex.value >= searchMatches.value.length) searchMatchIndex.value = 0;
    searchMatches.value.forEach((node, index) => node.classList.toggle("is-active", index === searchMatchIndex.value));
  }

  function focusSearchMatch(index) {
    if (!searchMatches.value.length) return;
    const safeIndex = ((index % searchMatches.value.length) + searchMatches.value.length) % searchMatches.value.length;
    searchMatchIndex.value = safeIndex;
    searchMatches.value.forEach((node, nextIndex) => node.classList.toggle("is-active", nextIndex === safeIndex));
    searchMatches.value[safeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function jumpSearchMatch(step) {
    if (!searchMatches.value.length) return;
    focusSearchMatch(searchMatchIndex.value + step);
  }

  watch(
    () => [props.searching, props.searchResultText, props.messages.length],
    async () => {
      await nextTick();
      collectSearchMatches();
    },
    { deep: true },
  );

  return {
    jumpSearchMatch,
    searchMatchIndex,
    searchMatches,
  };
}

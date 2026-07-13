import { computed, ref, watch } from "vue";

export function useListSearch({ openRef, keywordRef, recentKeywordsRef, sectionsRef, onPick, onRecentPick, onFooterPick }) {
  const activeIndex = ref(-1);

  const flatOptions = computed(() => {
    const keyword = String(keywordRef.value || "").trim();
    if (!keyword) {
      return [
        ...recentKeywordsRef.value.map((item) => ({
          key: `recent:${item}`,
          type: "recent",
          value: item,
        })),
        { key: "footer:entry", type: "footer" },
      ];
    }

    const resultItems = sectionsRef.value.flatMap((section) => (
      (section.items || []).map((item) => ({
        key: item.key,
        type: "result",
        value: item,
      }))
    ));

    return [...resultItems, { key: "footer:entry", type: "footer" }];
  });

  const activeKey = computed(() => flatOptions.value[activeIndex.value]?.key || "");

  function resetActive() {
    activeIndex.value = flatOptions.value.length ? 0 : -1;
  }

  function move(step) {
    if (!openRef.value || !flatOptions.value.length) return;
    if (activeIndex.value < 0) {
      activeIndex.value = 0;
      return;
    }
    const nextIndex = (activeIndex.value + step + flatOptions.value.length) % flatOptions.value.length;
    activeIndex.value = nextIndex;
  }

  function triggerActive() {
    const active = flatOptions.value[activeIndex.value];
    if (!active) return false;
    if (active.type === "recent") {
      onRecentPick(active.value);
      return true;
    }
    if (active.type === "result") {
      onPick(active.value);
      return true;
    }
    if (active.type === "footer") {
      onFooterPick();
      return true;
    }
    return false;
  }

  watch(() => openRef.value, (open) => {
    if (open) resetActive();
    else activeIndex.value = -1;
  });

  watch(() => keywordRef.value, () => {
    resetActive();
  });

  watch(() => sectionsRef.value, () => {
    if (!openRef.value) return;
    if (!flatOptions.value.length) {
      activeIndex.value = -1;
      return;
    }
    if (activeIndex.value >= flatOptions.value.length) {
      activeIndex.value = flatOptions.value.length - 1;
    }
  }, { deep: true });

  return {
    activeKey,
    flatOptions,
    move,
    resetActive,
    triggerActive,
  };
}

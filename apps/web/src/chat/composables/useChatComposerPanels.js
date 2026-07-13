import { nextTick, onBeforeUnmount, ref } from "vue";

export function useChatComposerPanels(focusComposer) {
  const emojiOpen = ref(false);
  const stickerOpen = ref(false);
  const closeFloatingPanels = () => { emojiOpen.value = false; stickerOpen.value = false; };

  function handleGlobalPointer(event) {
    const target = event.target;
    if (target instanceof HTMLElement
      && (target.closest(".emoji-picker") || target.closest(".sticker-picker") || target.closest(".qq-chat-tool-btn.is-emoji") || target.closest(".qq-chat-tool-btn.is-sticker"))) return;
    closeFloatingPanels();
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape") closeFloatingPanels();
  }

  window.addEventListener("pointerdown", handleGlobalPointer);
  window.addEventListener("keydown", handleGlobalKeydown);
  onBeforeUnmount(() => {
    window.removeEventListener("pointerdown", handleGlobalPointer);
    window.removeEventListener("keydown", handleGlobalKeydown);
  });

  function toggleEmojiPicker() {
    stickerOpen.value = false;
    emojiOpen.value = !emojiOpen.value;
    if (emojiOpen.value) nextTick(focusComposer);
  }

  function toggleStickerPicker() {
    emojiOpen.value = false;
    stickerOpen.value = !stickerOpen.value;
  }

  return {
    emojiOpen,
    stickerOpen,
    closeFloatingPanels,
    toggleEmojiPicker,
    toggleStickerPicker,
  };
}

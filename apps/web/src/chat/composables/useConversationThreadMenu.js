import { onBeforeUnmount, ref } from "vue";

export function useConversationThreadMenu(emit) {
  const menuOpen = ref(false);
  const menuX = ref(0);
  const menuY = ref(0);
  const menuRow = ref(null);

  function closeMenu() {
    menuOpen.value = false;
    menuRow.value = null;
  }

  function openMenu(event, row) {
    menuOpen.value = true;
    menuRow.value = row;
    menuX.value = event.clientX;
    menuY.value = event.clientY;
  }

  function handleCopyTitle() {
    if (!menuRow.value) return;
    emit("copy-title", menuRow.value);
    closeMenu();
  }

  function handleTogglePin(row = menuRow.value) {
    if (!row) return;
    emit("toggle-pin", row);
    closeMenu();
  }

  function handleToggleMute(row = menuRow.value) {
    if (!row) return;
    emit("toggle-mute", row);
    closeMenu();
  }

  function handleMarkRead() {
    if (!menuRow.value) return;
    emit("mark-read", menuRow.value);
    closeMenu();
  }

  function handleHideConversation() {
    if (!menuRow.value) return;
    emit("hide-conversation", menuRow.value);
    closeMenu();
  }

  onBeforeUnmount(closeMenu);

  return {
    closeMenu,
    handleCopyTitle,
    handleHideConversation,
    handleMarkRead,
    handleToggleMute,
    handleTogglePin,
    menuOpen,
    menuRow,
    menuX,
    menuY,
    openMenu,
  };
}

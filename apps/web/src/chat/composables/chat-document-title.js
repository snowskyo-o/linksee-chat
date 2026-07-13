export function syncChatDocumentTitle({ chatTitle = "", hasConversation = false, profileName = "" }) {
  const appTitle = "Linksee Chat";
  if (hasConversation && chatTitle) {
    document.title = `${chatTitle} · ${appTitle}`;
    return;
  }
  document.title = profileName ? `${appTitle} · ${profileName}` : appTitle;
}

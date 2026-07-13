export function createRealtimeRefreshScheduler({ actions, syncReadStateIfFocused }) {
  let conversationsRefreshTimer = null;
  let selectedRefreshTimer = null;

  function scheduleConversationsRefresh() {
    if (conversationsRefreshTimer) window.clearTimeout(conversationsRefreshTimer);
    conversationsRefreshTimer = window.setTimeout(() => {
      actions.loadConversations().catch(() => {});
      conversationsRefreshTimer = null;
    }, 120);
  }

  function scheduleSelectedRefresh() {
    if (selectedRefreshTimer) window.clearTimeout(selectedRefreshTimer);
    selectedRefreshTimer = window.setTimeout(() => {
      actions.refreshSelectedConversation().then(() => syncReadStateIfFocused(actions)).catch(() => {});
      selectedRefreshTimer = null;
    }, 120);
  }

  function clearRealtimeTimers() {
    if (conversationsRefreshTimer) window.clearTimeout(conversationsRefreshTimer);
    if (selectedRefreshTimer) window.clearTimeout(selectedRefreshTimer);
  }

  return {
    clearRealtimeTimers,
    scheduleConversationsRefresh,
    scheduleSelectedRefresh,
  };
}

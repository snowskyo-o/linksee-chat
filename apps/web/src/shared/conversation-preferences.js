const STORAGE_KEY = "linksee_chat_conversation_preferences";

function normalizeIds(items) {
  return Array.from(new Set(
    Array.isArray(items)
      ? items.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  ));
}

export function loadConversationPreferences() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      mutedConversationIds: normalizeIds(parsed?.mutedConversationIds),
      hiddenConversationIds: normalizeIds(parsed?.hiddenConversationIds),
    };
  } catch {
    return {
      mutedConversationIds: [],
      hiddenConversationIds: [],
    };
  }
}

export function saveConversationPreferences(preferences) {
  const nextValue = {
    mutedConversationIds: normalizeIds(preferences?.mutedConversationIds),
    hiddenConversationIds: normalizeIds(preferences?.hiddenConversationIds),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
  return nextValue;
}

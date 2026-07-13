import { ref } from "vue";

const RECENT_SEARCHES_KEY = "linksee_chat_recent_searches";

function loadRecentKeywords() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function useRecentKeywords() {
  const recentKeywords = ref(loadRecentKeywords());

  function persistRecentKeywords(items) {
    recentKeywords.value = items.slice(0, 8);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentKeywords.value));
  }

  function pushRecentKeyword(value) {
    const keyword = String(value || "").trim();
    if (!keyword) return;
    persistRecentKeywords([keyword, ...recentKeywords.value.filter((item) => item !== keyword)]);
  }

  function clearRecentKeywords() {
    persistRecentKeywords([]);
  }

  return {
    recentKeywords,
    pushRecentKeyword,
    clearRecentKeywords,
  };
}

export function formatConversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

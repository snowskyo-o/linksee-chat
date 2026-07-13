export const RECENT_EMOJIS_KEY = "linksee_chat_recent_emojis";
export const RECENT_EMOJI_LIMIT = 18;

export const emojiGroups = [
  {
    title: "常用",
    items: ["😀", "😁", "😂", "🤣", "😊", "😍", "🥳", "😎", "🙂", "😉", "🤗", "🥰"],
  },
  {
    title: "表情",
    items: ["😄", "😆", "😅", "😇", "🙂", "🙃", "😉", "😌", "😋", "😜", "🤩", "🥺"],
  },
  {
    title: "情绪",
    items: ["😭", "😡", "😤", "😱", "😴", "🤔", "🫠", "😬", "🥲", "😮", "😶", "🫡"],
  },
  {
    title: "动作",
    items: ["👍", "👏", "🙏", "🤝", "💪", "🙌", "👌", "✌️", "🤟", "👋", "💯", "🎉"],
  },
  {
    title: "爱心",
    items: ["❤️", "🩷", "🧡", "💛", "💚", "🩵", "💙", "💜", "🖤", "🤍", "💞", "💕"],
  },
  {
    title: "生活",
    items: ["☕", "🍵", "🍔", "🍰", "🍓", "🌹", "🍀", "🌈", "⭐", "✨", "🎵", "🎧"],
  },
  {
    title: "动物",
    items: ["🐱", "🐶", "🐼", "🐰", "🦊", "🐯", "🐻", "🐨", "🐸", "🐵", "🦄", "🐧"],
  },
];

export function loadRecentEmojis() {
  try {
    const stored = window.localStorage.getItem(RECENT_EMOJIS_KEY) || "[]";
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, RECENT_EMOJI_LIMIT) : [];
  } catch {
    return [];
  }
}

export function buildRecentEmojis(items) {
  return items.slice(0, RECENT_EMOJI_LIMIT);
}

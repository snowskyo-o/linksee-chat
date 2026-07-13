<script setup>
import { computed, ref } from "vue";

const RECENT_EMOJIS_KEY = "linksee_chat_recent_emojis";
const RECENT_EMOJI_LIMIT = 18;

const emojiGroups = [
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

function loadRecentEmojis() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_EMOJIS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, RECENT_EMOJI_LIMIT) : [];
  } catch {
    return [];
  }
}

defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(["pick"]);
const recentEmojis = ref(loadRecentEmojis());
const visibleGroups = computed(() => {
  if (!recentEmojis.value.length) return emojiGroups;
  return [{ title: "最近使用", items: recentEmojis.value }, ...emojiGroups];
});

function persistRecentEmojis(items) {
  recentEmojis.value = items.slice(0, RECENT_EMOJI_LIMIT);
  window.localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(recentEmojis.value));
}

function handlePick(emoji) {
  emit("pick", emoji);
  persistRecentEmojis([emoji, ...recentEmojis.value.filter((item) => item !== emoji)]);
}

function clearRecentEmojis() {
  persistRecentEmojis([]);
}
</script>

<template>
  <div v-if="open" class="emoji-picker">
    <section v-for="group in visibleGroups" :key="group.title" class="emoji-picker-group">
      <header class="emoji-picker-group-title">
        <span>{{ group.title }}</span>
        <button v-if="group.title === '最近使用' && recentEmojis.length" class="ghost-btn compact-btn" type="button" @click="clearRecentEmojis">
          清空
        </button>
      </header>
      <div class="emoji-picker-row">
        <button
          v-for="emoji in group.items"
          :key="emoji"
          class="emoji-picker-btn"
          type="button"
          @click="handlePick(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </section>
    <section class="emoji-picker-group">
      <header class="emoji-picker-group-title">颜文字</header>
      <div class="emoji-picker-row emoji-picker-row-wide">
        <button class="emoji-picker-btn emoji-picker-btn-text" type="button" @click="handlePick('(＾▽＾)')">(＾▽＾)</button>
        <button class="emoji-picker-btn emoji-picker-btn-text" type="button" @click="handlePick('(╥﹏╥)')">(╥﹏╥)</button>
        <button class="emoji-picker-btn emoji-picker-btn-text" type="button" @click="handlePick('(ง •̀_•́)ง')">(ง •̀_•́)ง</button>
        <button class="emoji-picker-btn emoji-picker-btn-text" type="button" @click="handlePick('(๑•̀ㅂ•́)و✧')">(๑•̀ㅂ•́)و✧</button>
      </div>
    </section>
  </div>
</template>

<script setup>
const emojiGroups = [
  ["😀", "😁", "😂", "🤣", "😊", "😍", "🥳", "😎"],
  ["🤔", "😅", "😭", "😴", "😡", "👀", "💤", "✨"],
  ["🙂", "😉", "😋", "😌", "🤗", "😇", "🥰", "😘"],
  ["👍", "👏", "🙏", "🤝", "💪", "🔥", "🎉", "❤️"],
  ["👋", "👌", "✌️", "🤟", "🙌", "💯", "🌹", "☕"],
  ["🐱", "🐶", "🐼", "🐰", "🍀", "🌈", "⭐", "🎵"],
];

defineProps({
  open: { type: Boolean, default: false },
});

defineEmits(["pick"]);
</script>

<template>
  <div v-if="open" class="emoji-picker">
    <div v-for="(group, index) in emojiGroups" :key="index" class="emoji-picker-row">
      <button
        v-for="emoji in group"
        :key="emoji"
        class="emoji-picker-btn"
        type="button"
        @click="$emit('pick', emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </div>
</template>

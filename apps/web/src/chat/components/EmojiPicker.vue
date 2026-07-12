<script setup>
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

defineProps({
  open: { type: Boolean, default: false },
});

defineEmits(["pick"]);
</script>

<template>
  <div v-if="open" class="emoji-picker">
    <section v-for="group in emojiGroups" :key="group.title" class="emoji-picker-group">
      <header class="emoji-picker-group-title">{{ group.title }}</header>
      <div class="emoji-picker-row">
        <button
          v-for="emoji in group.items"
          :key="emoji"
          class="emoji-picker-btn"
          type="button"
          @click="$emit('pick', emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </section>
    <section class="emoji-picker-group">
      <header class="emoji-picker-group-title">颜文字</header>
      <div class="emoji-picker-row emoji-picker-row-wide">
        <button class="emoji-picker-btn emoji-picker-btn-text" type="button" @click="$emit('pick', '(＾▽＾)')">(＾▽＾)</button>
        <button class="emoji-picker-btn emoji-picker-btn-text" type="button" @click="$emit('pick', '(╥﹏╥)')">(╥﹏╥)</button>
        <button class="emoji-picker-btn emoji-picker-btn-text" type="button" @click="$emit('pick', '(ง •̀_•́)ง')">(ง •̀_•́)ง</button>
        <button class="emoji-picker-btn emoji-picker-btn-text" type="button" @click="$emit('pick', '(๑•̀ㅂ•́)و✧')">(๑•̀ㅂ•́)و✧</button>
      </div>
    </section>
  </div>
</template>

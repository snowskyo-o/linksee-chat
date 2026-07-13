<script setup>
defineProps({
  mentionOpen: { type: Boolean, default: false },
  mentionOptions: { type: Array, default: () => [] },
});

defineEmits(["pick"]);
</script>

<template>
  <div v-if="mentionOpen && mentionOptions.length" class="mention-panel">
    <div
      v-for="(user, index) in mentionOptions"
      :key="user.id"
      class="mention-item"
      :class="{ active: index === 0 }"
      @click="$emit('pick', user.id)"
    >
      @{{ user.profile.realName || user.id }}
    </div>
  </div>
</template>

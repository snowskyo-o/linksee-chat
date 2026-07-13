<script setup>
defineProps({
  count: { type: Number, default: 0 },
  title: { type: String, required: true },
});
</script>

<template>
  <section class="new-friends-group">
    <div class="new-friends-group-head">
      <strong>{{ title }}</strong>
      <span>{{ count }}</span>
    </div>
    <slot />
  </section>
</template>

<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  contact: { type: Object, required: true },
  description: { type: String, default: "" },
  recent: { type: Boolean, default: false },
});
</script>

<template>
  <article class="new-friends-item" :class="{ 'is-recent': recent }">
    <div class="new-friends-avatar">
      <AvatarImage :src="contact.avatarUrl" alt="">
        <span>{{ contact.name.slice(0, 2).toUpperCase() }}</span>
      </AvatarImage>
    </div>
    <div class="new-friends-copy">
      <strong>{{ contact.name }}</strong>
      <p>{{ description }}</p>
    </div>
    <slot />
  </article>
</template>

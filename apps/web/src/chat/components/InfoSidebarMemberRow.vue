<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  isGroupOwner: { type: Boolean, default: false },
  user: { type: Object, required: true },
});

defineEmits(["remove"]);
</script>

<template>
  <article class="desktop-participant-item">
    <div class="desktop-participant-avatar">
      <AvatarImage :src="user.profile?.avatarUrl || ''" alt="">
        <span>{{ user.name.slice(0, 2).toUpperCase() }}</span>
      </AvatarImage>
    </div>
    <div class="desktop-participant-copy">
      <strong>{{ user.name }}</strong>
      <small>{{ user.isOwner ? "群主" : "普通成员" }}{{ user.isMe ? " · 我" : "" }} · 账号：{{ user.account }}</small>
      <p>{{ user.bio }}</p>
    </div>
    <button
      v-if="isGroupOwner && !user.isOwner && !user.isMe"
      class="ghost-btn compact-btn is-danger desktop-member-remove"
      type="button"
      @click="$emit('remove', user)"
    >
      移除
    </button>
  </article>
</template>

<style scoped>
.desktop-participant-copy small {
  color: var(--muted);
  font-size: 12px;
}

.desktop-participant-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: #f9fbff;
}

.desktop-participant-avatar {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(135deg, #dbe8ff, #eff5ff);
  color: #315cb7;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.desktop-participant-avatar :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.desktop-participant-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.desktop-participant-copy strong {
  font-size: 15px;
  color: #1f2a44;
}

.desktop-participant-copy p {
  margin: 0;
  color: #52627f;
  font-size: 12px;
  line-height: 1.45;
  word-break: break-word;
}

.desktop-member-remove {
  align-self: center;
  margin-left: auto;
}
</style>

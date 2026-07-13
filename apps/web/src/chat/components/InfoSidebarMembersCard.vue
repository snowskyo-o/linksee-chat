<script setup>
import InfoSidebarMemberRow from "./InfoSidebarMemberRow.vue";

defineProps({
  isGroupOwner: { type: Boolean, default: false },
  participantRows: { type: Array, default: () => [] },
  standaloneMode: { type: Boolean, default: false },
});

defineEmits(["remove-group-member"]);
</script>

<template>
  <section class="detail-card qq-side-card" :class="{ 'is-standalone': standaloneMode }">
    <div class="detail-card-head">
      <h3>群成员</h3>
      <span class="sidebar-count">{{ participantRows.length }}</span>
    </div>
    <div v-if="participantRows.length" class="desktop-participant-list">
      <InfoSidebarMemberRow
        v-for="user in participantRows"
        :key="user.id"
        :is-group-owner="isGroupOwner"
        :user="user"
        @remove="$emit('remove-group-member', user)"
      />
    </div>
    <div v-else class="detail-card-blank-body is-compact">
      <p class="muted">暂时还没有可展示的群成员。</p>
    </div>
  </section>
</template>

<style scoped>
.sidebar-count,
.desktop-participant-copy small {
  color: var(--muted);
  font-size: 12px;
}

.desktop-participant-list {
  display: grid;
  gap: 10px;
}

.is-compact {
  min-height: 120px;
}
</style>

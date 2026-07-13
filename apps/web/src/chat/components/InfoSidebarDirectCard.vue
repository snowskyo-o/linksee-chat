<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";
import InfoSidebarInfoRow from "./InfoSidebarInfoRow.vue";

defineProps({
  directPeer: { type: Object, default: null },
  infoRows: { type: Array, default: () => [] },
  standaloneMode: { type: Boolean, default: false },
});
</script>

<template>
  <section class="detail-card qq-side-card" :class="{ 'is-standalone': standaloneMode }">
    <div class="detail-card-head">
      <h3>联系人资料</h3>
    </div>
    <div v-if="directPeer" class="sidebar-profile">
      <div class="sidebar-profile-hero">
        <div class="sidebar-avatar">
          <AvatarImage :src="directPeer.profile?.avatarUrl || ''" alt="">
            <span>{{ directPeer.name.slice(0, 2).toUpperCase() }}</span>
          </AvatarImage>
        </div>
        <div class="sidebar-profile-copy">
          <strong>{{ directPeer.name }}</strong>
          <small>{{ directPeer.account }}</small>
        </div>
      </div>

      <dl class="sidebar-info-list">
        <InfoSidebarInfoRow
          v-for="row in infoRows"
          :key="row.label"
          :row="row"
        />
      </dl>
    </div>
  </section>
</template>

<style scoped>
.sidebar-profile {
  display: grid;
  gap: 16px;
}

.sidebar-profile-hero {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sidebar-avatar {
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

.sidebar-avatar :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-profile-copy {
  display: grid;
  gap: 4px;
}

.sidebar-profile-copy strong {
  font-size: 15px;
  color: #1f2a44;
}

.sidebar-profile-copy small {
  color: var(--muted);
  font-size: 12px;
}

.sidebar-info-list {
  margin: 0;
  display: grid;
  gap: 10px;
}
</style>

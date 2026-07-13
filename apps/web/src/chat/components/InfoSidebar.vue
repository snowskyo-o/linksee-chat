<script setup>
import { computed } from "vue";
import AvatarImage from "../../shared/components/AvatarImage.vue";

const props = defineProps({
  conversation: { type: Object, default: null },
  participants: { type: Array, default: () => [] },
  currentUserId: { type: String, default: "" },
  standaloneMode: { type: Boolean, default: false },
});

const participantRows = computed(() => (Array.isArray(props.participants) ? props.participants : []).map((user) => ({
  ...user,
  name: user?.friendAlias || user?.profile?.realName || user?.id || "未命名用户",
  account: user?.id || "",
  bio: user?.profile?.bio || "这个成员还没有留下签名",
  isMe: String(user?.id || "") === String(props.currentUserId || ""),
})));

const directPeer = computed(() => participantRows.value.find((user) => !user.isMe) || participantRows.value[0] || null);
const infoRows = computed(() => {
  const peer = directPeer.value;
  if (!peer) return [];
  return [
    { label: "昵称", value: peer.name || "未设置" },
    { label: "账号", value: peer.account || "未知账号" },
    { label: "签名", value: peer.bio || "这个联系人还没有留下签名" },
  ];
});
</script>

<template>
  <aside class="chat-detail-panel" :class="{ 'is-standalone': standaloneMode }">
    <section v-if="!conversation" class="detail-card qq-side-card detail-card-blank" :class="{ 'is-standalone': standaloneMode }">
      <div class="detail-card-head">
        <h3>资料面板</h3>
      </div>
      <div class="detail-card-blank-body">
        <p class="muted">选择一个联系人或群聊后，这里会显示资料和成员信息。</p>
      </div>
    </section>

    <template v-else-if="conversation.kind === 'direct'">
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
            <div v-for="row in infoRows" :key="row.label" class="sidebar-info-item">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="detail-card qq-side-card" :class="{ 'is-standalone': standaloneMode }">
        <div class="detail-card-head">
          <h3>群聊资料</h3>
        </div>
        <div class="sidebar-profile">
          <div class="sidebar-profile-copy is-group">
            <strong>{{ conversation.title || "群聊" }}</strong>
            <small>{{ participantRows.length }} 位成员</small>
          </div>
        </div>
      </section>

      <section class="detail-card qq-side-card" :class="{ 'is-standalone': standaloneMode }">
        <div class="detail-card-head">
          <h3>群成员</h3>
          <span class="sidebar-count">{{ participantRows.length }}</span>
        </div>
        <div v-if="participantRows.length" class="desktop-participant-list">
          <article v-for="user in participantRows" :key="user.id" class="desktop-participant-item">
            <div class="desktop-participant-avatar">
              <AvatarImage :src="user.profile?.avatarUrl || ''" alt="">
                <span>{{ user.name.slice(0, 2).toUpperCase() }}</span>
              </AvatarImage>
            </div>
            <div class="desktop-participant-copy">
              <strong>{{ user.name }}</strong>
              <small>{{ user.isMe ? `账号：${user.account} · 我` : `账号：${user.account}` }}</small>
              <p>{{ user.bio }}</p>
            </div>
          </article>
        </div>
        <div v-else class="detail-card-blank-body is-compact">
          <p class="muted">暂时还没有可展示的群成员。</p>
        </div>
      </section>
    </template>
  </aside>
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

.sidebar-avatar,
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

.sidebar-avatar :deep(img),
.desktop-participant-avatar :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-profile-copy {
  display: grid;
  gap: 4px;
}

.sidebar-profile-copy.is-group {
  gap: 6px;
}

.sidebar-profile-copy strong,
.desktop-participant-copy strong {
  font-size: 15px;
  color: #1f2a44;
}

.sidebar-profile-copy small,
.desktop-participant-copy small,
.sidebar-count {
  color: var(--muted);
  font-size: 12px;
}

.sidebar-info-list {
  margin: 0;
  display: grid;
  gap: 10px;
}

.sidebar-info-item {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f7faff;
}

.sidebar-info-item dt {
  color: var(--muted);
  font-size: 12px;
}

.sidebar-info-item dd {
  margin: 0;
  color: #24324d;
  line-height: 1.5;
  word-break: break-word;
}

.desktop-participant-list {
  display: grid;
  gap: 10px;
}

.desktop-participant-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: #f9fbff;
}

.desktop-participant-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.desktop-participant-copy p {
  margin: 0;
  color: #52627f;
  font-size: 12px;
  line-height: 1.45;
  word-break: break-word;
}

.is-compact {
  min-height: 120px;
}
</style>

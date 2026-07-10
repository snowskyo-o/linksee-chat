<script setup>
defineProps({
  meAvatarUrl: { type: String, default: "" },
  profileName: { type: String, default: "" },
  profileBio: { type: String, default: "" },
  profileHint: { type: String, default: "" },
  profileHintTone: { type: String, default: "" },
  participants: { type: Array, default: () => [] },
});

defineEmits(["update:profileName", "update:profileBio", "save-profile", "upload-avatar"]);
</script>

<template>
  <aside class="chat-detail-panel">
    <section class="detail-card profile-edit-card">
      <div class="detail-card-head">
        <h3>我的资料</h3>
      </div>
      <form class="profile-form" @submit.prevent="$emit('save-profile')">
        <div class="profile-avatar-block desktop-profile-block">
          <div class="profile-avatar-large">
            <img v-if="meAvatarUrl" :src="meAvatarUrl" alt="" />
            <span v-else>{{ (profileName || 'ME').slice(0, 2).toUpperCase() }}</span>
          </div>
          <label class="ghost-btn profile-avatar-upload compact-btn">
            更换头像
            <input class="hidden" type="file" accept="image/*" @change="$emit('upload-avatar', $event)" />
          </label>
        </div>
        <label class="field field-quiet">
          <span>昵称</span>
          <input :value="profileName" placeholder="输入你的昵称" @input="$emit('update:profileName', $event.target.value)" />
        </label>
        <label class="field field-quiet">
          <span>个性签名</span>
          <textarea
            :value="profileBio"
            rows="4"
            placeholder="写一句你的状态"
            @input="$emit('update:profileBio', $event.target.value)"
          ></textarea>
        </label>
        <button class="secondary-btn" type="submit">保存</button>
        <div class="hint" :class="profileHint ? (profileHintTone === 'error' ? 'is-error' : 'is-success') : ''">
          {{ profileHint }}
        </div>
      </form>
    </section>

    <section class="detail-card">
      <div class="detail-card-head">
        <h3>会话成员</h3>
        <span class="muted">{{ participants.length }} 人</span>
      </div>
      <div class="participant-list desktop-participant-list">
        <div v-if="!participants.length" class="empty-state">暂无成员</div>
        <article v-for="user in participants" :key="user.id" class="participant-item desktop-participant-item">
          <div class="participant-head">
            <div class="participant-avatar">
              <img v-if="user.profile.avatarUrl" :src="user.profile.avatarUrl" alt="" />
              <span v-else>{{ (user.profile.realName || user.id).slice(0, 2).toUpperCase() }}</span>
            </div>
            <div class="participant-copy">
              <div class="participant-line">
                <strong>{{ user.profile.realName || user.id }}</strong>
                <span v-if="user.role === 'admin'" class="badge ghost">管理员</span>
              </div>
              <p>{{ user.profile.bio || "这个人很低调" }}</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  </aside>
</template>

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
  <aside class="qq-sidepanel">
    <section class="profile-card">
      <h3>资料</h3>
      <form class="profile-form" @submit.prevent="$emit('save-profile')">
        <div class="profile-avatar-block">
          <div class="profile-avatar-large">
            <img v-if="meAvatarUrl" :src="meAvatarUrl" alt="" />
            <span v-else>{{ (profileName || "ME").slice(0, 2).toUpperCase() }}</span>
          </div>
          <label class="ghost-btn profile-avatar-upload">
            上传头像
            <input class="hidden" type="file" accept="image/*" @change="$emit('upload-avatar', $event)" />
          </label>
        </div>
        <label class="field">
          <span>昵称</span>
          <input :value="profileName" placeholder="输入显示昵称" @input="$emit('update:profileName', $event.target.value)" />
        </label>
        <label class="field">
          <span>简介</span>
          <textarea
            :value="profileBio"
            rows="4"
            placeholder="写一句你的状态"
            @input="$emit('update:profileBio', $event.target.value)"
          ></textarea>
        </label>
        <button class="secondary-btn" type="submit">保存资料</button>
        <div class="hint" :class="profileHint ? (profileHintTone === 'error' ? 'is-error' : 'is-success') : ''">
          {{ profileHint }}
        </div>
      </form>
    </section>

    <section class="profile-card">
      <h3>成员</h3>
      <div class="participant-list">
        <div v-if="!participants.length" class="empty-state">暂无成员。</div>
        <article v-for="user in participants" :key="user.id" class="participant-item">
          <div class="participant-head">
            <div class="participant-avatar">
              <img v-if="user.profile.avatarUrl" :src="user.profile.avatarUrl" alt="" />
              <span v-else>{{ (user.profile.realName || user.id).slice(0, 2).toUpperCase() }}</span>
            </div>
            <div>
              <strong>{{ user.profile.realName || user.id }}</strong>
              <p class="muted">{{ user.id }}<span v-if="user.role"> · {{ user.role }}</span></p>
            </div>
          </div>
          <p class="muted">{{ user.profile.bio || "这个人很低调" }}</p>
        </article>
      </div>
    </section>
  </aside>
</template>

<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  meAvatarUrl: { type: String, default: "" },
  profileAccount: { type: String, default: "" },
  profileRole: { type: String, default: "" },
  profileName: { type: String, default: "" },
  profileBio: { type: String, default: "" },
  profileHint: { type: String, default: "" },
  profileHintTone: { type: String, default: "" },
});

defineEmits([
  "logout",
  "save-profile",
  "update:profileBio",
  "update:profileName",
  "upload-avatar",
]);
</script>

<template>
  <section class="settings-card">
    <div class="detail-card-head">
      <h3>个人资料</h3>
    </div>
    <form class="profile-form" @submit.prevent="$emit('save-profile')">
      <div class="profile-avatar-block desktop-profile-block">
        <div class="profile-avatar-large">
          <AvatarImage :src="meAvatarUrl" alt="">
            <span>{{ (profileName || "ME").slice(0, 2).toUpperCase() }}</span>
          </AvatarImage>
        </div>
        <label class="ghost-btn profile-avatar-upload compact-btn">
          更换头像
          <input class="hidden" type="file" accept="image/*" @change="$emit('upload-avatar', $event)" />
        </label>
      </div>
      <label class="field field-quiet">
        <span>账号</span>
        <input :value="profileAccount" readonly />
      </label>
      <label v-if="profileRole" class="field field-quiet">
        <span>身份</span>
        <input :value="profileRole" readonly />
      </label>
      <label class="field field-quiet">
        <span>昵称</span>
        <input :value="profileName" placeholder="输入你的昵称" @input="$emit('update:profileName', $event.target.value)" />
      </label>
      <label class="field field-quiet">
        <span>个性签名</span>
        <textarea :value="profileBio" rows="4" placeholder="写一句你的状态" @input="$emit('update:profileBio', $event.target.value)"></textarea>
      </label>
      <div class="settings-inline-actions">
        <button class="secondary-btn" type="submit">保存资料</button>
        <button class="ghost-btn compact-btn is-danger" type="button" @click="$emit('logout')">退出登录</button>
      </div>
      <div class="hint" :class="profileHint ? (profileHintTone === 'error' ? 'is-error' : 'is-success') : ''">
        {{ profileHint }}
      </div>
    </form>
  </section>
</template>

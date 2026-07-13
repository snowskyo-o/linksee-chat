<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  previewAvatarUrl: { type: String, default: "" },
  previewBio: { type: String, default: "" },
  previewInitials: { type: String, default: "" },
  previewLoading: { type: Boolean, default: false },
  previewName: { type: String, default: "" },
  userId: { type: String, default: "" },
});
</script>

<template>
  <div class="compact-auth-login-top">
    <div class="compact-auth-login-avatar-wrap">
      <div class="compact-auth-avatar compact-auth-login-avatar">
        <AvatarImage :src="previewAvatarUrl" alt="">
          <span>{{ previewInitials }}</span>
        </AvatarImage>
      </div>
    </div>

    <div class="compact-auth-copy compact-auth-login-copy">
      <h1>{{ previewLoading ? "正在读取资料..." : previewName }}</h1>
      <strong class="compact-auth-preview-id">{{ userId || "请输入账号" }}</strong>
      <p>{{ previewBio }}</p>
    </div>
  </div>
</template>

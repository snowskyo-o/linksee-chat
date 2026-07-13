<script setup>
import LoginPagePreviewCard from "./LoginPagePreviewCard.vue";

defineProps({
  autoLogin: { type: Boolean, default: false },
  capsLockOn: { type: Boolean, default: false },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
  password: { type: String, default: "" },
  previewAvatarUrl: { type: String, default: "" },
  previewBio: { type: String, default: "" },
  previewInitials: { type: String, default: "" },
  previewLoading: { type: Boolean, default: false },
  previewName: { type: String, default: "" },
  rememberAccount: { type: Boolean, default: false },
  showPassword: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  userId: { type: String, default: "" },
});

defineEmits(["blur-user-id", "forgot-password", "open-register", "submit", "toggle-password", "update:auto-login", "update:password", "update:remember-account", "update:user-id", "updateCapsLock"]);
</script>

<template>
  <section class="compact-auth-body compact-auth-body-login">
    <LoginPagePreviewCard :preview-avatar-url="previewAvatarUrl" :preview-bio="previewBio" :preview-initials="previewInitials" :preview-loading="previewLoading" :preview-name="previewName" :user-id="userId" />
    <div class="compact-auth-form-head compact-auth-form-head-login">
      <strong>账号登录</strong>
      <span>输入账号和密码后登录</span>
    </div>

    <form class="compact-auth-form compact-auth-form-login" @submit.prevent="$emit('submit')">
      <label class="compact-auth-field">
        <span>账号</span>
        <input
          :value="userId"
          name="userId"
          placeholder="请输入账号"
          autocomplete="username"
          :disabled="submitting"
          @blur="$emit('blur-user-id')"
          @input="$emit('update:user-id', $event.target.value)"
        />
      </label>

      <label class="compact-auth-field">
        <span>密码</span>
        <div class="compact-auth-password-wrap">
          <input
            :value="password"
            name="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            autocomplete="current-password"
            :disabled="submitting"
            @input="$emit('update:password', $event.target.value)"
            @keydown="$emit('updateCapsLock', $event)"
            @keyup="$emit('updateCapsLock', $event)"
          />
          <button
            class="compact-auth-password-toggle"
            type="button"
            :disabled="submitting"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            @click="$emit('toggle-password')"
          >
            {{ showPassword ? "隐藏" : "显示" }}
          </button>
        </div>
      </label>

      <div class="compact-auth-options">
        <label class="compact-auth-check">
          <input :checked="rememberAccount" type="checkbox" :disabled="submitting || autoLogin" @change="$emit('update:remember-account', $event.target.checked)" />
          <span>记住账号</span>
        </label>
        <label class="compact-auth-check">
          <input :checked="autoLogin" type="checkbox" :disabled="submitting" @change="$emit('update:auto-login', $event.target.checked)" />
          <span>自动登录</span>
        </label>
      </div>

      <button class="primary-btn compact-auth-submit compact-auth-login-submit" type="submit" :disabled="submitting">{{ submitting ? "登录中..." : "登录" }}</button>
      <div class="compact-auth-links">
        <button type="button" :disabled="submitting" @click="$emit('forgot-password')">忘记密码</button>
        <button type="button" :disabled="submitting" @click="$emit('open-register')">注册账号</button>
      </div>
      <p class="compact-auth-status" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">
        {{ capsLockOn ? "Caps Lock 已开启" : hint }}
      </p>
    </form>
  </section>
</template>

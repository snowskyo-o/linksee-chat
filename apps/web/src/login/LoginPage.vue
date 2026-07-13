<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import AvatarImage from "../shared/components/AvatarImage.vue";
import LoginAssistDialog from "./components/LoginAssistDialog.vue";
import RegisterAccountDialog from "./components/RegisterAccountDialog.vue";
import { applyAppearanceMode, watchSystemAppearance } from "../shared/appearance-mode.js";
import { loadAppSettings, subscribeAppSettings } from "../shared/app-settings.js";
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { useLoginPreview } from "./useLoginPreview.js";
import { useLoginSession } from "./useLoginSession.js";
import { useRegisterAccount } from "./useRegisterAccount.js";

const shell = useDesktopShell();
const appSettings = ref(loadAppSettings());
const rememberedAccount = localStorage.getItem("login_remember_account") === "true";
const userId = ref(rememberedAccount ? (localStorage.getItem("login_last_user_id") || "") : "");
const password = ref("");
const showPassword = ref(false);
const rememberAccount = ref(rememberedAccount);
const autoLogin = ref(localStorage.getItem("login_auto_login") === "true");
const capsLockOn = ref(false);
const passwordInput = ref(null);
const assistTitle = ref("");
const assistMessage = ref("");
const assistOpen = ref(false);
let detachAppSettings = null;
let detachSystemAppearance = null;

const { loadPreview, previewAvatarUrl, previewBio, previewInitials, previewLoading, previewName } = useLoginPreview(userId);
const { hint, hintTone, submitLogin, submitting, tryAutoLogin } = useLoginSession({
  autoLogin,
  password,
  passwordInput,
  rememberAccount,
  userId,
});
const {
  openRegisterAccount,
  registerForm,
  registerHint,
  registerHintTone,
  registerOpen,
  registerSubmitting,
  submitRegister,
} = useRegisterAccount({
  loadPreview,
  password,
  userId,
});

function handleUserIdBlur() {
  loadPreview(userId.value);
}

function updateCapsLock(event) {
  if (typeof event.getModifierState === "function") {
    capsLockOn.value = event.getModifierState("CapsLock");
  }
}

function openAssistDialog(title, message) {
  assistTitle.value = title;
  assistMessage.value = message;
  assistOpen.value = true;
}

function openForgotPassword() {
  const account = String(userId.value || "").trim();
  openAssistDialog(
    "忘记密码",
    account
      ? `当前版本暂未接入在线找回流程，请联系管理员协助重置账号 ${account} 的密码。`
      : "当前版本暂未接入在线找回流程，请联系管理员协助重置密码。",
  );
}

function syncAppearance() {
  applyAppearanceMode(appSettings.value.appearance?.themeMode || "system");
}

async function handleRegisterSubmit() {
  const result = await submitRegister();
  if (!result?.success) return;
  hint.value = "注册成功，请确认后登录";
  hintTone.value = "success";
}

onMounted(() => {
  syncAppearance();
  detachAppSettings = subscribeAppSettings((nextSettings) => {
    appSettings.value = nextSettings;
    syncAppearance();
  });
  detachSystemAppearance = watchSystemAppearance(() => {
    if ((appSettings.value.appearance?.themeMode || "system") === "system") syncAppearance();
  });
  if (userId.value) loadPreview(userId.value);
  tryAutoLogin();
});

onBeforeUnmount(() => {
  if (typeof detachAppSettings === "function") detachAppSettings();
  if (typeof detachSystemAppearance === "function") detachSystemAppearance();
});
</script>

<template>
  <main class="compact-auth-shell" :class="{ 'is-desktop': shell.isDesktop }">
    <section class="compact-auth-card compact-auth-login-card" :class="{ 'is-desktop': shell.isDesktop }">
      <header class="compact-auth-header">
        <div class="compact-auth-drag">
          <span class="compact-auth-logo">L</span>
          <div class="compact-auth-brand">
            <strong>Linksee Chat</strong>
            <span>桌面聊天客户端</span>
          </div>
        </div>

        <div v-if="shell.isDesktop" class="compact-auth-window-actions">
          <button class="compact-auth-window-btn compact-auth-window-btn-light" type="button" aria-label="最小化" @click="shell.minimizeWindow">─</button>
          <button class="compact-auth-window-btn compact-auth-window-btn-light is-close" type="button" aria-label="关闭" @click="shell.closeWindow">×</button>
        </div>
      </header>

      <section class="compact-auth-body compact-auth-body-login">
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

        <div class="compact-auth-form-head compact-auth-form-head-login">
          <strong>账号登录</strong>
          <span>输入账号和密码后登录</span>
        </div>

        <form class="compact-auth-form compact-auth-form-login" @submit.prevent="submitLogin">
          <label class="compact-auth-field">
            <span>账号</span>
            <input
              v-model="userId"
              name="userId"
              placeholder="请输入账号"
              autocomplete="username"
              :disabled="submitting"
              @blur="handleUserIdBlur"
            />
          </label>

          <label class="compact-auth-field">
            <span>密码</span>
            <div class="compact-auth-password-wrap">
              <input
                ref="passwordInput"
                v-model="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                autocomplete="current-password"
                :disabled="submitting"
                @keydown="updateCapsLock"
                @keyup="updateCapsLock"
              />
              <button
                class="compact-auth-password-toggle"
                type="button"
                :disabled="submitting"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? "隐藏" : "显示" }}
              </button>
            </div>
          </label>

          <div class="compact-auth-options">
            <label class="compact-auth-check">
              <input v-model="rememberAccount" type="checkbox" :disabled="submitting || autoLogin" />
              <span>记住账号</span>
            </label>
            <label class="compact-auth-check">
              <input
                v-model="autoLogin"
                type="checkbox"
                :disabled="submitting"
                @change="rememberAccount = rememberAccount || autoLogin"
              />
              <span>自动登录</span>
            </label>
          </div>

          <button class="primary-btn compact-auth-submit compact-auth-login-submit" type="submit" :disabled="submitting">
            {{ submitting ? "登录中..." : "登录" }}
          </button>

          <div class="compact-auth-links">
            <button type="button" :disabled="submitting" @click="openForgotPassword">忘记密码</button>
            <button type="button" :disabled="submitting" @click="openRegisterAccount">注册账号</button>
          </div>

          <p class="compact-auth-status" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">
            {{ capsLockOn ? "Caps Lock 已开启" : hint }}
          </p>
        </form>
      </section>
    </section>

    <LoginAssistDialog
      :open="assistOpen"
      :title="assistTitle"
      :message="assistMessage"
      @close="assistOpen = false"
    />

    <RegisterAccountDialog
      :open="registerOpen"
      :form="registerForm"
      :hint="registerHint"
      :hint-tone="registerHintTone"
      :submitting="registerSubmitting"
      @close="registerOpen = false"
      @update:form="registerForm = $event"
      @submit="handleRegisterSubmit"
    />
  </main>
</template>

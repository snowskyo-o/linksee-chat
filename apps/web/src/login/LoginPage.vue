<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import { chatApi } from "../shared/api-client.js";
import AvatarImage from "../shared/components/AvatarImage.vue";
import { resolveMediaUrl } from "../shared/media.js";
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { isDesktopRuntime, navigateTo } from "../shared/runtime.js";
import { getInitials } from "../shared/utils.js";

const shell = useDesktopShell();
const rememberedAccount = localStorage.getItem("login_remember_account") === "true";
const rememberedAutoLogin = localStorage.getItem("login_auto_login") === "true";
const userId = ref(rememberedAccount ? (localStorage.getItem("login_last_user_id") || "") : "");
const password = ref("");
const hint = ref("");
const hintTone = ref("");
const submitting = ref(false);
const previewLoading = ref(false);
const previewName = ref("欢迎回来");
const previewBio = ref("输入账号以查看头像和昵称");
const previewAvatarUrl = ref("");
const showPassword = ref(false);
const rememberAccount = ref(rememberedAccount);
const autoLogin = ref(rememberedAutoLogin);
const capsLockOn = ref(false);
const passwordInput = ref(null);

const previewInitials = computed(() => getInitials(previewName.value, userId.value || "LC"));

async function loadPreview(nextUserId) {
  const account = String(nextUserId || "").trim();
  previewAvatarUrl.value = "";

  if (!account) {
    previewName.value = "欢迎回来";
    previewBio.value = "输入账号以查看头像和昵称";
    previewLoading.value = false;
    return;
  }

  previewLoading.value = true;
  try {
    const payload = await chatApi.request(`/api/v1/users/${encodeURIComponent(account)}/profile`);
    const profile = payload.data?.profile || {};
    previewName.value = profile.realName || account;
    previewBio.value = profile.bio || "准备开始新的会话";
    previewAvatarUrl.value = resolveMediaUrl(profile.avatarUrl || "");
  } catch (error) {
    previewName.value = account;
    previewBio.value = error?.code === "NETWORK_ERROR"
      ? `暂时无法连接 ${chatApi.getApiBaseUrl()}`
      : "未找到资料，确认账号后可直接登录";
    previewAvatarUrl.value = "";
  } finally {
    previewLoading.value = false;
  }
}

function handleUserIdBlur() {
  loadPreview(userId.value);
}

function persistLoginPreferences(account) {
  localStorage.setItem("login_remember_account", rememberAccount.value ? "true" : "false");
  localStorage.setItem("login_auto_login", autoLogin.value ? "true" : "false");
  if (rememberAccount.value || autoLogin.value) localStorage.setItem("login_last_user_id", account);
  else localStorage.removeItem("login_last_user_id");
}

function saveSession(account, data = {}) {
  localStorage.setItem("chat_access_token", data.accessToken || "");
  localStorage.setItem("chat_refresh_token", data.refreshToken || "");
  localStorage.setItem("chat_user_id", account);
  localStorage.setItem("chat_role", data.role || "");
}

async function enterChat() {
  if (isDesktopRuntime() && typeof window.desktopShell?.loginSuccess === "function") {
    await window.desktopShell.loginSuccess();
    return;
  }
  navigateTo("chat");
}

function normalizeLoginError(error) {
  if (error?.code === "NETWORK_ERROR") return "登录失败，请检查网络后重试";
  if (error?.code === "UNAUTHENTICATED") return "账号或密码错误";
  return "登录失败，请稍后重试";
}

function updateCapsLock(event) {
  if (typeof event.getModifierState === "function") {
    capsLockOn.value = event.getModifierState("CapsLock");
  }
}

async function submitLogin() {
  if (!userId.value.trim() || !password.value) {
    hint.value = "请输入账号和密码";
    hintTone.value = "error";
    await nextTick();
    if (!password.value) passwordInput.value?.focus?.();
    return;
  }

  submitting.value = true;
  hint.value = "正在登录...";
  hintTone.value = "success";

  try {
    const payload = await chatApi.postJson("/api/v1/auth/login", {
      userId: userId.value.trim(),
      password: password.value,
    });
    const data = payload.data || {};
    const account = userId.value.trim();
    saveSession(account, data);
    persistLoginPreferences(account);
    await enterChat();
  } catch (error) {
    hint.value = normalizeLoginError(error);
    hintTone.value = "error";
    await nextTick();
    passwordInput.value?.focus?.();
  } finally {
    submitting.value = false;
  }
}

async function tryAutoLogin() {
  const refreshToken = localStorage.getItem("chat_refresh_token") || "";
  const account = localStorage.getItem("chat_user_id") || userId.value.trim();
  if (!autoLogin.value || !refreshToken || !account) return;

  submitting.value = true;
  hint.value = "正在登录...";
  hintTone.value = "success";
  try {
    const payload = await chatApi.postJson("/api/v1/auth/refresh", { refreshToken });
    saveSession(account, payload.data || {});
    await enterChat();
  } catch {
    hint.value = "";
    hintTone.value = "";
    localStorage.setItem("login_auto_login", "false");
    autoLogin.value = false;
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  if (userId.value) loadPreview(userId.value);
  tryAutoLogin();
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
            <button type="button">忘记密码</button>
            <button type="button">注册账号</button>
          </div>

          <p class="compact-auth-status" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">
            {{ capsLockOn ? "Caps Lock 已开启" : hint }}
          </p>
        </form>
      </section>
    </section>
  </main>
</template>

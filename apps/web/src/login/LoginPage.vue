<script setup>
import { computed, ref, watch } from "vue";
import { chatApi } from "../shared/api-client.js";
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { isDesktopRuntime, navigateTo } from "../shared/runtime.js";
import { getInitials } from "../shared/utils.js";

const shell = useDesktopShell();
const userId = ref("");
const password = ref("");
const hint = ref("");
const hintTone = ref("");
const submitting = ref(false);
const previewLoading = ref(false);
const previewName = ref("欢迎回来");
const previewBio = ref("输入账号以查看头像和昵称");
const previewAvatarUrl = ref("");

const previewInitials = computed(() => getInitials(previewName.value, userId.value || "LC"));

let previewTimer = null;

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
    previewAvatarUrl.value = profile.avatarUrl || "";
  } catch (error) {
    previewName.value = account;
    previewBio.value = error?.code === "NETWORK_ERROR"
      ? "暂时无法连接服务器，联网后可自动读取资料"
      : "未找到资料，确认账号后可直接登录";
    previewAvatarUrl.value = "";
  } finally {
    previewLoading.value = false;
  }
}

watch(userId, (value) => {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    loadPreview(value);
  }, 180);
});

async function submitLogin() {
  if (!userId.value.trim() || !password.value) {
    hint.value = "请输入账号和密码";
    hintTone.value = "error";
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
    localStorage.setItem("chat_access_token", data.accessToken || "");
    localStorage.setItem("chat_refresh_token", data.refreshToken || "");
    localStorage.setItem("chat_user_id", userId.value.trim());
    localStorage.setItem("chat_role", data.role || "");
    if (isDesktopRuntime() && typeof window.desktopShell?.loginSuccess === "function") {
      await window.desktopShell.loginSuccess();
      return;
    }
    navigateTo("chat");
  } catch (error) {
    hint.value = error?.message || "登录失败，请稍后重试";
    hintTone.value = "error";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="compact-auth-shell">
    <section class="compact-auth-card">
      <header class="compact-auth-header">
        <div class="compact-auth-drag">
          <span class="compact-auth-logo">L</span>
          <div class="compact-auth-brand">
            <strong>Linksee Chat</strong>
            <span>账号登录</span>
          </div>
        </div>

        <div v-if="shell.isDesktop" class="compact-auth-window-actions">
          <button class="compact-auth-window-btn" type="button" aria-label="最小化" @click="shell.minimizeWindow">-</button>
          <button class="compact-auth-window-btn is-close" type="button" aria-label="关闭" @click="shell.closeWindow">×</button>
        </div>
      </header>

      <section class="compact-auth-body">
        <div class="compact-auth-avatar">
          <img v-if="previewAvatarUrl" :src="previewAvatarUrl" alt="" />
          <span v-else>{{ previewInitials }}</span>
        </div>

        <div class="compact-auth-copy">
          <h1>{{ previewLoading ? "正在读取资料..." : previewName }}</h1>
          <p>{{ previewBio }}</p>
        </div>

        <form class="compact-auth-form" @submit.prevent="submitLogin">
          <label class="compact-auth-field">
            <input v-model="userId" name="userId" placeholder="QQ号 / 用户账号" autocomplete="username" />
          </label>

          <label class="compact-auth-field">
            <input
              v-model="password"
              name="password"
              type="password"
              placeholder="密码"
              autocomplete="current-password"
            />
          </label>

          <button class="primary-btn compact-auth-submit" type="submit" :disabled="submitting">
            {{ submitting ? "登录中..." : "登 录" }}
          </button>

          <p class="compact-auth-status" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">
            {{ hint || "测试账号：1000000001 / Chat1234" }}
          </p>
        </form>
      </section>
    </section>
  </main>
</template>

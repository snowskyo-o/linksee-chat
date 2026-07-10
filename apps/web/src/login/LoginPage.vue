<script setup>
import { computed, ref, watch } from "vue";
import { chatApi } from "../shared/api-client.js";
import DesktopTitlebar from "../shared/components/DesktopTitlebar.vue";
import { getInitials } from "../shared/utils.js";

const userId = ref("");
const password = ref("");
const hint = ref("");
const hintTone = ref("");
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
  } catch {
    previewName.value = account;
    previewBio.value = "未找到资料，确认账号后可直接登录";
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
    window.location.href = "/chat";
  } catch (error) {
    hint.value = error?.message || "登录失败，请稍后重试";
    hintTone.value = "error";
  }
}
</script>

<template>
  <main class="desktop-page-shell auth-page-shell">
    <DesktopTitlebar app-title="Linksee Chat" view-title="账号登录" view-meta="桌面聊天客户端" />

    <section class="auth-stage">
      <section class="auth-window">
        <aside class="auth-showcase">
          <div class="auth-brand-row">
            <div class="auth-brand-badge">L</div>
            <div>
              <h1>Linksee Chat</h1>
              <p>简洁、克制、专注沟通</p>
            </div>
          </div>

          <div class="account-preview-card">
            <div class="account-preview-avatar">
              <img v-if="previewAvatarUrl" :src="previewAvatarUrl" alt="" />
              <span v-else>{{ previewInitials }}</span>
            </div>
            <div class="account-preview-copy">
              <strong>{{ previewName }}</strong>
              <p>{{ previewLoading ? "正在读取账号资料..." : previewBio }}</p>
            </div>
          </div>
        </aside>

        <section class="auth-form-panel">
          <div class="auth-window-head">
            <h2>账号登录</h2>
            <span class="auth-window-tag">客户端模式</span>
          </div>

          <form class="auth-form" @submit.prevent="submitLogin">
            <label class="field field-quiet">
              <span>账号</span>
              <input v-model="userId" name="userId" placeholder="输入账号" autocomplete="username" />
            </label>

            <label class="field field-quiet">
              <span>密码</span>
              <input
                v-model="password"
                name="password"
                type="password"
                placeholder="输入密码"
                autocomplete="current-password"
              />
            </label>

            <button class="primary-btn auth-submit" type="submit">登录</button>
            <div class="hint" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">
              {{ hint }}
            </div>
          </form>
        </section>
      </section>
    </section>
  </main>
</template>

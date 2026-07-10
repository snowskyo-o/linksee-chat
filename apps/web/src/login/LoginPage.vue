<script setup>
import { ref } from "vue";
import { chatApi } from "../shared/api-client.js";

const userId = ref("");
const password = ref("");
const hint = ref("");
const hintTone = ref("");

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
  <main class="auth-layout">
    <section class="auth-card">
      <div class="brand-lockup">
        <div class="brand-mark"></div>
        <div>
          <h1>Linksee Chat</h1>
          <p>最小聊天产品</p>
        </div>
      </div>

      <form class="stack-lg" @submit.prevent="submitLogin">
        <label class="field">
          <span>账号</span>
          <input v-model="userId" name="userId" placeholder="10 位数字账号" autocomplete="username" />
        </label>

        <label class="field">
          <span>密码</span>
          <input
            v-model="password"
            name="password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
          />
        </label>

        <button class="primary-btn" type="submit">进入聊天</button>
        <div class="hint" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">
          {{ hint }}
        </div>
      </form>
    </section>

    <section class="auth-copy">
      <span class="eyebrow">Vue + Vite</span>
      <h2>保留会话、消息和实时推送，把协作平台收敛成一个纯聊天软件。</h2>
      <p>当前版本已经升级为 Vue 前端结构，后续更适合继续封装成桌面程序。</p>
    </section>
  </main>
</template>

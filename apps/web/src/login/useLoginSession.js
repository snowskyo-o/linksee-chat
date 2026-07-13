import { nextTick, ref } from "vue";
import { chatApi } from "../shared/api-client.js";
import { isDesktopRuntime, navigateTo } from "../shared/runtime.js";

export function useLoginSession({ autoLogin, password, passwordInput, rememberAccount, userId }) {
  const rememberedAccount = localStorage.getItem("login_remember_account") === "true";
  const rememberedAutoLogin = localStorage.getItem("login_auto_login") === "true";
  const hint = ref("");
  const hintTone = ref("");
  const submitting = ref(false);

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
      const account = userId.value.trim();
      saveSession(account, payload.data || {});
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

  return {
    hint,
    hintTone,
    rememberedAccount,
    rememberedAutoLogin,
    submitLogin,
    submitting,
    tryAutoLogin,
  };
}

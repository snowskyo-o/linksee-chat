import { ref } from "vue";
import { chatApi } from "../shared/api-client.js";

export function useRegisterAccount({ loadPreview, password, userId }) {
  const registerOpen = ref(false);
  const registerSubmitting = ref(false);
  const registerHint = ref("");
  const registerHintTone = ref("");
  const registerForm = ref({
    userId: "",
    realName: "",
    password: "",
    confirmPassword: "",
    bio: "",
  });

  function openRegisterAccount() {
    registerForm.value = {
      userId: userId.value.trim(),
      realName: "",
      password: "",
      confirmPassword: "",
      bio: "",
    };
    registerHint.value = "";
    registerHintTone.value = "";
    registerSubmitting.value = false;
    registerOpen.value = true;
  }

  async function submitRegister() {
    const form = {
      userId: String(registerForm.value.userId || "").trim(),
      realName: String(registerForm.value.realName || "").trim(),
      password: String(registerForm.value.password || ""),
      confirmPassword: String(registerForm.value.confirmPassword || ""),
      bio: String(registerForm.value.bio || "").trim(),
    };
    if (!form.userId || !form.realName || !form.password || !form.confirmPassword) {
      registerHint.value = "请完整填写账号、昵称和密码";
      registerHintTone.value = "error";
      return;
    }
    if (form.password.length < 6) {
      registerHint.value = "密码至少需要 6 位";
      registerHintTone.value = "error";
      return;
    }
    if (form.password !== form.confirmPassword) {
      registerHint.value = "两次输入的密码不一致";
      registerHintTone.value = "error";
      return;
    }

    registerSubmitting.value = true;
    registerHint.value = "";
    registerHintTone.value = "";
    try {
      await chatApi.postJson("/api/v1/auth/register", {
        userId: form.userId,
        realName: form.realName,
        password: form.password,
        bio: form.bio,
      });
      registerHint.value = "注册成功，请使用新账号登录";
      registerHintTone.value = "success";
      userId.value = form.userId;
      password.value = form.password;
      registerOpen.value = false;
      await loadPreview(form.userId);
      return {
        success: true,
        userId: form.userId,
      };
    } catch (error) {
      registerHint.value = error?.message || "注册失败，请稍后重试";
      registerHintTone.value = "error";
      return { success: false };
    } finally {
      registerSubmitting.value = false;
    }
  }

  return {
    openRegisterAccount,
    registerForm,
    registerHint,
    registerHintTone,
    registerOpen,
    registerSubmitting,
    submitRegister,
  };
}

import { ref } from "vue";
import { chatApi } from "../../shared/api-client.js";

export function usePasswordChange() {
  const passwordHint = ref("");
  const passwordHintTone = ref("");
  const passwordSubmitting = ref(false);

  async function submitPassword(payload = {}) {
    const currentPassword = String(payload.currentPassword || "");
    const nextPassword = String(payload.nextPassword || "");
    const confirmPassword = String(payload.confirmPassword || "");

    if (!currentPassword || !nextPassword || !confirmPassword) {
      passwordHint.value = "请完整填写当前密码、新密码和确认密码";
      passwordHintTone.value = "error";
      return false;
    }
    if (nextPassword.length < 6) {
      passwordHint.value = "新密码至少需要 6 位";
      passwordHintTone.value = "error";
      return false;
    }
    if (nextPassword !== confirmPassword) {
      passwordHint.value = "两次输入的新密码不一致";
      passwordHintTone.value = "error";
      return false;
    }
    if (currentPassword === nextPassword) {
      passwordHint.value = "新密码不能与当前密码相同";
      passwordHintTone.value = "error";
      return false;
    }

    passwordSubmitting.value = true;
    passwordHint.value = "";
    passwordHintTone.value = "";
    try {
      await chatApi.patchJson("/api/v1/users/me/password", {
        currentPassword,
        nextPassword,
      });
      passwordHint.value = "密码已更新";
      passwordHintTone.value = "success";
      return true;
    } catch (error) {
      passwordHint.value = error?.message || "修改密码失败";
      passwordHintTone.value = "error";
      return false;
    } finally {
      passwordSubmitting.value = false;
    }
  }

  return {
    passwordHint,
    passwordHintTone,
    passwordSubmitting,
    submitPassword,
  };
}

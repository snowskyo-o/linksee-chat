import { ref } from "vue";

export function useLoginAssistDialog(userId) {
  const assistTitle = ref("");
  const assistMessage = ref("");
  const assistOpen = ref(false);

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

  return { assistMessage, assistOpen, assistTitle, openForgotPassword };
}

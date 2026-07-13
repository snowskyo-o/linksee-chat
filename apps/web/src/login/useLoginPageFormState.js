import { ref } from "vue";

export function useLoginPageFormState() {
  const rememberedAccount = localStorage.getItem("login_remember_account") === "true";
  const userId = ref(rememberedAccount ? (localStorage.getItem("login_last_user_id") || "") : "");
  const password = ref("");
  const showPassword = ref(false);
  const rememberAccount = ref(rememberedAccount);
  const autoLogin = ref(localStorage.getItem("login_auto_login") === "true");
  const capsLockOn = ref(false);
  const passwordInput = ref(null);

  function updateCapsLock(event) {
    if (typeof event.getModifierState === "function") {
      capsLockOn.value = event.getModifierState("CapsLock");
    }
  }

  return {
    autoLogin,
    capsLockOn,
    password,
    passwordInput,
    rememberAccount,
    showPassword,
    updateCapsLock,
    userId,
  };
}

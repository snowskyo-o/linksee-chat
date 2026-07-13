<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import LoginAssistDialog from "./components/LoginAssistDialog.vue";
import LoginPageAccountForm from "./components/LoginPageAccountForm.vue";
import LoginPageWindowHeader from "./components/LoginPageWindowHeader.vue";
import RegisterAccountDialog from "./components/RegisterAccountDialog.vue";
import { loadAppSettings } from "../shared/app-settings.js";
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { useLoginAssistDialog } from "./useLoginAssistDialog.js";
import { useLoginPageFormState } from "./useLoginPageFormState.js";
import { useLoginPageAppearance } from "./useLoginPageAppearance.js";
import { useLoginPreview } from "./useLoginPreview.js";
import { useLoginSession } from "./useLoginSession.js";
import { useRegisterAccount } from "./useRegisterAccount.js";

const shell = useDesktopShell();
const appSettings = ref(loadAppSettings());
const { autoLogin, capsLockOn, password, passwordInput, rememberAccount, showPassword, updateCapsLock, userId } = useLoginPageFormState();
const { loadPreview, previewAvatarUrl, previewBio, previewInitials, previewLoading, previewName } = useLoginPreview(userId);
const { hint, hintTone, submitLogin, submitting, tryAutoLogin } = useLoginSession({
  autoLogin,
  password,
  passwordInput,
  rememberAccount,
  userId,
});
const { assistMessage, assistOpen, assistTitle, openForgotPassword } = useLoginAssistDialog(userId);
const { mountAppearance, unmountAppearance } = useLoginPageAppearance(appSettings);
const { openRegisterAccount, registerForm, registerHint, registerHintTone, registerOpen, registerSubmitting, submitRegister } = useRegisterAccount({
  loadPreview,
  password,
  userId,
});

const handleUserIdBlur = () => loadPreview(userId.value);

async function handleRegisterSubmit() {
  const result = await submitRegister();
  if (!result?.success) return;
  hint.value = "注册成功，请确认后登录";
  hintTone.value = "success";
}

onMounted(() => {
  mountAppearance();
  if (userId.value) loadPreview(userId.value);
  tryAutoLogin();
});

onBeforeUnmount(() => {
  unmountAppearance();
});
</script>

<template>
  <main class="compact-auth-shell" :class="{ 'is-desktop': shell.isDesktop }">
    <section class="compact-auth-card compact-auth-login-card" :class="{ 'is-desktop': shell.isDesktop }">
      <LoginPageWindowHeader :is-desktop="shell.isDesktop" :shell="shell" />
      <LoginPageAccountForm
        :auto-login="autoLogin"
        :caps-lock-on="capsLockOn"
        :hint="hint"
        :hint-tone="hintTone"
        :password="password"
        :preview-avatar-url="previewAvatarUrl"
        :preview-bio="previewBio"
        :preview-initials="previewInitials"
        :preview-loading="previewLoading"
        :preview-name="previewName"
        :remember-account="rememberAccount"
        :show-password="showPassword"
        :submitting="submitting"
        :user-id="userId"
        @blur-user-id="handleUserIdBlur"
        @forgot-password="openForgotPassword"
        @open-register="openRegisterAccount"
        @submit="submitLogin"
        @toggle-password="showPassword = !showPassword"
        @update:auto-login="autoLogin = $event; rememberAccount = rememberAccount || autoLogin"
        @update:password="password = $event"
        @update:remember-account="rememberAccount = $event"
        @update:user-id="userId = $event" @updateCapsLock="updateCapsLock"
      />
    </section>
    <LoginAssistDialog :open="assistOpen" :title="assistTitle" :message="assistMessage" @close="assistOpen = false" />
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

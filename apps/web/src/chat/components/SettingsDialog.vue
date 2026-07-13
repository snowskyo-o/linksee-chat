<script setup>
import SettingsPreferencesCards from "./SettingsPreferencesCards.vue";
import SettingsProfileCard from "./SettingsProfileCard.vue";
import SettingsSecurityCard from "./SettingsSecurityCard.vue";
import SettingsStorageCards from "./SettingsStorageCards.vue";

defineProps({
  open: { type: Boolean, default: false },
  settings: { type: Object, default: () => ({ notifications: {}, general: {}, appearance: {}, files: {} }) },
  desktopPreferences: { type: Object, default: () => ({}) },
  profileAccount: { type: String, default: "" },
  profileRole: { type: String, default: "" },
  profileName: { type: String, default: "" },
  profileBio: { type: String, default: "" },
  profileHint: { type: String, default: "" },
  profileHintTone: { type: String, default: "" },
  passwordHint: { type: String, default: "" },
  passwordHintTone: { type: String, default: "" },
  passwordSubmitting: { type: Boolean, default: false },
  meAvatarUrl: { type: String, default: "" },
  appInfo: { type: Object, default: () => ({}) },
});

defineEmits([
  "choose-download-dir",
  "clear-cache",
  "close",
  "logout",
  "open-download-dir",
  "open-update",
  "save-profile",
  "submit-password",
  "update:desktopPreferences",
  "update:profileBio",
  "update:profileName",
  "update:settings",
  "upload-avatar",
]);
</script>

<template>
  <div v-if="open" class="settings-backdrop" @click.self="$emit('close')">
    <section class="settings-dialog">
      <header class="settings-header">
        <div>
          <h2>设置</h2>
          <p class="muted">个人资料、通知偏好和软件信息统一在这里管理。</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <div class="settings-layout">
        <SettingsProfileCard
          :me-avatar-url="meAvatarUrl"
          :profile-account="profileAccount"
          :profile-role="profileRole"
          :profile-name="profileName"
          :profile-bio="profileBio"
          :profile-hint="profileHint"
          :profile-hint-tone="profileHintTone"
          @logout="$emit('logout')"
          @save-profile="$emit('save-profile')"
          @update:profile-bio="$emit('update:profileBio', $event)"
          @update:profile-name="$emit('update:profileName', $event)"
          @upload-avatar="$emit('upload-avatar', $event)"
        />

        <SettingsPreferencesCards
          :app-info="appInfo"
          :desktop-preferences="desktopPreferences"
          :settings="settings"
          @open-update="$emit('open-update')"
          @update:desktop-preferences="$emit('update:desktopPreferences', $event)"
          @update:settings="$emit('update:settings', $event)"
        />

        <SettingsSecurityCard
          :open="open"
          :password-hint="passwordHint"
          :password-hint-tone="passwordHintTone"
          :password-submitting="passwordSubmitting"
          @submit-password="$emit('submit-password', $event)"
        />

        <SettingsStorageCards
          :app-info="appInfo"
          :desktop-preferences="desktopPreferences"
          :settings="settings"
          @choose-download-dir="$emit('choose-download-dir')"
          @clear-cache="$emit('clear-cache')"
          @open-download-dir="$emit('open-download-dir')"
          @update:settings="$emit('update:settings', $event)"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import SettingsPreferencesAboutCard from "./SettingsPreferencesAboutCard.vue";
import SettingsPreferencesAppearanceCard from "./SettingsPreferencesAppearanceCard.vue";
import SettingsPreferencesGeneralCard from "./SettingsPreferencesGeneralCard.vue";
import SettingsPreferencesNotificationsCard from "./SettingsPreferencesNotificationsCard.vue";

const props = defineProps({
  appInfo: { type: Object, default: () => ({}) },
  desktopPreferences: { type: Object, default: () => ({}) },
  settings: { type: Object, default: () => ({ notifications: {}, general: {}, appearance: {} }) },
});

const emit = defineEmits([
  "open-update",
  "update:desktopPreferences",
  "update:settings",
]);

function patchSettings(section, key, value) {
  emit("update:settings", {
    ...(props.settings || {}),
    [section]: {
      ...(props.settings?.[section] || {}),
      [key]: value,
    },
  });
}

function patchDesktopPreferences(key, value) {
  emit("update:desktopPreferences", {
    ...(props.desktopPreferences || {}),
    [key]: value,
  });
}

function handleSettingsPatch([section, key, value]) {
  patchSettings(section, key, value);
}

function handleDesktopPreferencesPatch([key, value]) {
  patchDesktopPreferences(key, value);
}
</script>

<template>
  <SettingsPreferencesNotificationsCard
    :desktop-preferences="desktopPreferences"
    :settings="settings"
    @update:desktop-preferences="handleDesktopPreferencesPatch"
    @update:settings="handleSettingsPatch"
  />
  <SettingsPreferencesGeneralCard
    :desktop-preferences="desktopPreferences"
    :settings="settings"
    @update:desktop-preferences="handleDesktopPreferencesPatch"
    @update:settings="handleSettingsPatch"
  />
  <SettingsPreferencesAppearanceCard
    :settings="settings"
    @update:settings="handleSettingsPatch"
  />
  <SettingsPreferencesAboutCard
    :app-info="appInfo"
    @open-update="$emit('open-update')"
  />
</template>

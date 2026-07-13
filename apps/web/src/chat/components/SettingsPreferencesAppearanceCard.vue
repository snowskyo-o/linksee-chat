<script setup>
defineProps({
  settings: { type: Object, default: () => ({ appearance: {} }) },
});

defineEmits(["update:settings"]);
</script>

<template>
  <section class="settings-card">
    <div class="detail-card-head">
      <h3>外观</h3>
    </div>
    <div class="settings-field-group">
      <span>主题模式</span>
      <div class="settings-choice-row">
        <label class="settings-choice">
          <input :checked="(settings?.appearance?.themeMode || 'system') === 'light'" type="radio" name="theme-mode" @change="$emit('update:settings', ['appearance', 'themeMode', 'light'])" />
          <span>浅色模式</span>
        </label>
        <label class="settings-choice">
          <input :checked="(settings?.appearance?.themeMode || 'system') === 'dark'" type="radio" name="theme-mode" @change="$emit('update:settings', ['appearance', 'themeMode', 'dark'])" />
          <span>深色模式</span>
        </label>
        <label class="settings-choice">
          <input :checked="(settings?.appearance?.themeMode || 'system') === 'system'" type="radio" name="theme-mode" @change="$emit('update:settings', ['appearance', 'themeMode', 'system'])" />
          <span>跟随系统</span>
        </label>
      </div>
    </div>
  </section>
</template>

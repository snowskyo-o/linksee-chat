<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  passwordHint: { type: String, default: "" },
  passwordHintTone: { type: String, default: "" },
  passwordSubmitting: { type: Boolean, default: false },
});

const emit = defineEmits(["submit-password"]);

const currentPassword = ref("");
const nextPassword = ref("");
const confirmPassword = ref("");

function resetPasswordFields() {
  currentPassword.value = "";
  nextPassword.value = "";
  confirmPassword.value = "";
}

watch(() => props.open, (nextOpen) => {
  if (!nextOpen) resetPasswordFields();
});

watch(() => props.passwordHintTone, (tone) => {
  if (tone === "success") resetPasswordFields();
});
</script>

<template>
  <section class="settings-card">
    <div class="detail-card-head">
      <h3>账号安全</h3>
    </div>
    <form class="profile-form" @submit.prevent="$emit('submit-password', { currentPassword, nextPassword, confirmPassword })">
      <label class="field field-quiet">
        <span>当前密码</span>
        <input v-model="currentPassword" type="password" placeholder="输入当前密码" />
      </label>
      <label class="field field-quiet">
        <span>新密码</span>
        <input v-model="nextPassword" type="password" placeholder="至少 6 位" />
      </label>
      <label class="field field-quiet">
        <span>确认新密码</span>
        <input v-model="confirmPassword" type="password" placeholder="再次输入新密码" />
      </label>
      <div class="settings-inline-actions">
        <button class="secondary-btn" type="submit" :disabled="passwordSubmitting">
          {{ passwordSubmitting ? "修改中..." : "修改密码" }}
        </button>
      </div>
      <div class="hint" :class="passwordHint ? (passwordHintTone === 'error' ? 'is-error' : 'is-success') : ''">
        {{ passwordHint }}
      </div>
    </form>
  </section>
</template>

<script setup>
const props = defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, default: () => ({}) },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
  submitting: { type: Boolean, default: false },
});

defineEmits(["close", "submit", "update:form"]);

function patch(field, value) {
  const nextForm = {
    userId: String(props.form?.userId || ""),
    realName: String(props.form?.realName || ""),
    password: String(props.form?.password || ""),
    confirmPassword: String(props.form?.confirmPassword || ""),
    bio: String(props.form?.bio || ""),
    [field]: value,
  };
  return nextForm;
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card create-dialog-card">
      <header class="dialog-head">
        <div>
          <h3>注册账号</h3>
          <p class="muted">创建一个新的 Linksee Chat 账号</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <form class="profile-form" @submit.prevent="$emit('submit')">
        <label class="field field-quiet">
          <span>账号</span>
          <input
            :value="form?.userId || ''"
            placeholder="4 到 32 位字母、数字或下划线"
            @input="$emit('update:form', patch('userId', $event.target.value))"
          />
        </label>

        <label class="field field-quiet">
          <span>昵称</span>
          <input
            :value="form?.realName || ''"
            placeholder="例如：张三"
            @input="$emit('update:form', patch('realName', $event.target.value))"
          />
        </label>

        <label class="field field-quiet">
          <span>密码</span>
          <input
            :value="form?.password || ''"
            type="password"
            placeholder="至少 6 位"
            @input="$emit('update:form', patch('password', $event.target.value))"
          />
        </label>

        <label class="field field-quiet">
          <span>确认密码</span>
          <input
            :value="form?.confirmPassword || ''"
            type="password"
            placeholder="再次输入密码"
            @input="$emit('update:form', patch('confirmPassword', $event.target.value))"
          />
        </label>

        <label class="field field-quiet">
          <span>个性签名</span>
          <textarea
            :value="form?.bio || ''"
            rows="3"
            placeholder="可选，写一句你的状态"
            @input="$emit('update:form', patch('bio', $event.target.value))"
          ></textarea>
        </label>

        <div class="hint" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">
          {{ hint }}
        </div>

        <footer class="dialog-actions">
          <button class="ghost-btn" type="button" @click="$emit('close')">取消</button>
          <button class="primary-btn" type="submit" :disabled="submitting">
            {{ submitting ? "注册中..." : "注册账号" }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>

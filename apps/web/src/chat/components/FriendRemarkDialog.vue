<script setup>
defineProps({
  open: { type: Boolean, default: false },
  contact: { type: Object, default: null },
  value: { type: String, default: "" },
});

defineEmits(["close", "submit", "update:value"]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card friend-remark-dialog">
      <header class="dialog-head">
        <div>
          <h3>好友备注</h3>
          <p class="muted">为 {{ contact?.name || contact?.realName || "这位好友" }} 设置一个更好认的名字</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <label class="field field-quiet">
        <span>备注名</span>
        <input
          :value="value"
          maxlength="40"
          placeholder="输入备注名，留空则恢复默认昵称"
          @input="$emit('update:value', $event.target.value)"
        />
      </label>

      <div class="dialog-actions">
        <button class="ghost-btn" type="button" @click="$emit('close')">取消</button>
        <button class="primary-btn" type="button" @click="$emit('submit')">保存备注</button>
      </div>
    </section>
  </div>
</template>

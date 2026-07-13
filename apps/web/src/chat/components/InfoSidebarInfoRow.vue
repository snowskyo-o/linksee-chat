<script setup>
defineProps({
  row: { type: Object, required: true },
});
</script>

<template>
  <div class="sidebar-info-item">
    <dt>{{ row.label }}</dt>
    <dd>{{ row.value }}</dd>
  </div>
</template>

<style scoped>
.sidebar-info-item {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f7faff;
}

.sidebar-info-item dt {
  color: var(--muted);
  font-size: 12px;
}

.sidebar-info-item dd {
  margin: 0;
  color: #24324d;
  line-height: 1.5;
  word-break: break-word;
}
</style>

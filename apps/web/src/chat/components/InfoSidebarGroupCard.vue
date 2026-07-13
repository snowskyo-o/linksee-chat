<script setup>
defineProps({
  conversation: { type: Object, default: null },
  groupTitleDraft: { type: String, default: "" },
  isGroupOwner: { type: Boolean, default: false },
  participantCount: { type: Number, default: 0 },
  standaloneMode: { type: Boolean, default: false },
});

defineEmits(["update:groupTitleDraft", "rename-group", "invite-group-members", "leave-group"]);
</script>

<template>
  <section class="detail-card qq-side-card" :class="{ 'is-standalone': standaloneMode }">
    <div class="detail-card-head">
      <h3>群聊资料</h3>
    </div>
    <div class="sidebar-profile">
      <div v-if="isGroupOwner" class="sidebar-group-editor">
        <label class="field field-quiet">
          <span>群聊名称</span>
          <input
            :value="groupTitleDraft"
            placeholder="输入群聊名称"
            @input="$emit('update:groupTitleDraft', $event.target.value)"
          />
        </label>
        <div class="sidebar-group-actions">
          <button class="secondary-btn compact-btn" type="button" @click="$emit('rename-group', groupTitleDraft)">保存群名</button>
          <button class="ghost-btn compact-btn" type="button" @click="$emit('invite-group-members')">邀请成员</button>
          <button class="ghost-btn compact-btn is-danger" type="button" @click="$emit('leave-group')">退出群聊</button>
        </div>
      </div>
      <div v-else class="sidebar-profile-copy is-group">
        <strong>{{ conversation?.title || "群聊" }}</strong>
        <small>{{ participantCount }} 位成员 · 普通成员</small>
        <div class="sidebar-group-actions">
          <button class="ghost-btn compact-btn" type="button" @click="$emit('invite-group-members')">邀请成员</button>
          <button class="ghost-btn compact-btn is-danger" type="button" @click="$emit('leave-group')">退出群聊</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sidebar-profile {
  display: grid;
  gap: 16px;
}

.sidebar-profile-copy {
  display: grid;
  gap: 4px;
}

.sidebar-profile-copy.is-group {
  gap: 6px;
}

.sidebar-group-editor {
  display: grid;
  gap: 12px;
}

.sidebar-group-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sidebar-profile-copy strong {
  font-size: 15px;
  color: #1f2a44;
}

.sidebar-profile-copy small {
  color: var(--muted);
  font-size: 12px;
}
</style>

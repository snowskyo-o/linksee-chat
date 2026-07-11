<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: "direct" },
  title: { type: String, default: "" },
  peerId: { type: String, default: "" },
  participantIds: { type: Array, default: () => [] },
  contacts: { type: Array, default: () => [] },
  selectedParticipants: { type: Array, default: () => [] },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
  submitting: { type: Boolean, default: false },
});

defineEmits([
  "close",
  "submit",
  "update:title",
  "update:peerId",
  "toggle-participant",
]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card create-dialog-card">
      <header class="dialog-head">
        <div>
          <h3>{{ mode === 'direct' ? '发起私聊' : '创建群聊' }}</h3>
          <p class="muted">{{ mode === 'direct' ? '选择一个联系人开始聊天' : '选择成员并设置群聊名称' }}</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <div v-if="mode === 'group'" class="field field-quiet">
        <span>群聊名称</span>
        <input :value="title" placeholder="例如：项目讨论" @input="$emit('update:title', $event.target.value)" />
      </div>

      <div class="dialog-contact-list">
        <button
          v-for="contact in contacts"
          :key="contact.id"
          class="dialog-contact-item"
          :class="{
            'is-selected': mode === 'direct' ? peerId === contact.id : participantIds.includes(contact.id),
          }"
          type="button"
          @click="mode === 'direct' ? $emit('update:peerId', contact.id) : $emit('toggle-participant', contact.id)"
        >
          <div class="participant-avatar dialog-contact-avatar">
            <AvatarImage :src="contact.avatarUrl" alt="">
              <span>{{ contact.name.slice(0, 2).toUpperCase() }}</span>
            </AvatarImage>
          </div>
          <div class="dialog-contact-copy">
            <strong>{{ contact.name }}</strong>
            <p>{{ contact.bio || '这个人很低调' }}</p>
          </div>
        </button>
      </div>

      <div v-if="mode === 'group' && selectedParticipants.length" class="dialog-selected-strip">
        <span class="muted">已选成员</span>
        <div class="dialog-selected-tags">
          <span v-for="user in selectedParticipants" :key="user.id" class="dialog-tag">{{ user.profile?.realName || user.id }}</span>
        </div>
      </div>

      <div class="hint" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">{{ hint }}</div>

      <footer class="dialog-actions">
        <button class="ghost-btn" type="button" @click="$emit('close')">取消</button>
        <button class="primary-btn" type="button" :disabled="submitting" @click="$emit('submit')">
          {{ submitting ? '处理中...' : (mode === 'direct' ? '开始聊天' : '创建群聊') }}
        </button>
      </footer>
    </section>
  </div>
</template>

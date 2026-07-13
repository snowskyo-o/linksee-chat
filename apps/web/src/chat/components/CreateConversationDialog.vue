<script setup>
import { computed, ref, watch } from "vue";
import AvatarImage from "../../shared/components/AvatarImage.vue";

const props = defineProps({
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

const keyword = ref("");

const filteredContacts = computed(() => {
  const search = keyword.value.trim().toLowerCase();
  if (!search) return props.contacts;
  return props.contacts.filter((contact) => (
    [contact.name, contact.bio].some((value) => String(value || "").toLowerCase().includes(search))
  ));
});

const selectionSummary = computed(() => {
  if (props.mode === "direct") {
    return props.peerId ? "已选择 1 位联系人" : "请选择 1 位联系人";
  }
  return props.participantIds.length ? `已选择 ${props.participantIds.length} 位成员` : "至少选择 2 位成员";
});

watch(
  () => props.open,
  (open) => {
    if (open) keyword.value = "";
  },
);
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

      <div class="field field-quiet create-dialog-search-field">
        <span>搜索联系人</span>
        <input v-model="keyword" placeholder="按昵称或简介筛选" />
      </div>

      <div class="create-dialog-summary">
        <span>{{ selectionSummary }}</span>
        <strong>{{ filteredContacts.length }} 位可选</strong>
      </div>

      <div class="dialog-contact-list">
        <button
          v-for="contact in filteredContacts"
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
        <div v-if="!filteredContacts.length" class="empty-state">没有匹配的联系人</div>
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

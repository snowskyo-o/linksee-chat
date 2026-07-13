<script setup>
import { computed, ref, watch } from "vue";
import AvatarImage from "../../shared/components/AvatarImage.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  contacts: { type: Array, default: () => [] },
  selectedIds: { type: Array, default: () => [] },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
  submitting: { type: Boolean, default: false },
});

defineEmits(["close", "submit", "toggle-contact"]);

const keyword = ref("");

const filteredContacts = computed(() => {
  const search = keyword.value.trim().toLowerCase();
  if (!search) return props.contacts;
  return props.contacts.filter((contact) => (
    [contact.name, contact.realName, contact.bio].some((value) => String(value || "").toLowerCase().includes(search))
  ));
});

watch(() => props.open, (nextOpen) => {
  if (nextOpen) keyword.value = "";
});
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card create-dialog-card">
      <header class="dialog-head">
        <div>
          <h3>邀请成员</h3>
          <p class="muted">从联系人中选择成员加入当前群聊</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <div class="field field-quiet create-dialog-search-field">
        <span>搜索联系人</span>
        <input v-model="keyword" placeholder="按昵称、账号或签名筛选" />
      </div>

      <div class="create-dialog-summary">
        <span>{{ selectedIds.length ? `已选择 ${selectedIds.length} 位成员` : "请选择要邀请的联系人" }}</span>
        <strong>{{ filteredContacts.length }} 位可选</strong>
      </div>

      <div class="dialog-contact-list">
        <button
          v-for="contact in filteredContacts"
          :key="contact.id"
          class="dialog-contact-item"
          :class="{ 'is-selected': selectedIds.includes(contact.id) }"
          type="button"
          @click="$emit('toggle-contact', contact.id)"
        >
          <div class="participant-avatar dialog-contact-avatar">
            <AvatarImage :src="contact.avatarUrl" alt="">
              <span>{{ contact.name.slice(0, 2).toUpperCase() }}</span>
            </AvatarImage>
          </div>
          <div class="dialog-contact-copy">
            <strong>{{ contact.name }}</strong>
            <p>{{ contact.friendAlias && contact.realName && contact.realName !== contact.friendAlias ? `${contact.realName}${contact.bio ? ` · ${contact.bio}` : ""}` : (contact.bio || "这个人很低调") }}</p>
          </div>
        </button>
        <div v-if="!filteredContacts.length" class="empty-state">没有可邀请的联系人</div>
      </div>

      <div class="hint" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">{{ hint }}</div>

      <footer class="dialog-actions">
        <button class="ghost-btn" type="button" @click="$emit('close')">取消</button>
        <button class="primary-btn" type="button" :disabled="submitting" @click="$emit('submit')">
          {{ submitting ? "处理中..." : "邀请加入" }}
        </button>
      </footer>
    </section>
  </div>
</template>

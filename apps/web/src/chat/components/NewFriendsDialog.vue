<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  open: { type: Boolean, default: false },
  keyword: { type: String, default: "" },
  loading: { type: Boolean, default: false },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
  recentContacts: { type: Array, default: () => [] },
  incomingRequests: { type: Array, default: () => [] },
  outgoingRequests: { type: Array, default: () => [] },
  recommendedUsers: { type: Array, default: () => [] },
  friendContacts: { type: Array, default: () => [] },
});

defineEmits([
  "close",
  "update:keyword",
  "start-chat",
  "send-request",
  "accept-request",
  "reject-request",
  "cancel-request",
  "edit-friend",
  "remove-friend",
]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card new-friends-dialog-card">
      <header class="dialog-head">
        <div>
          <h3>新朋友</h3>
          <p class="muted">查找联系人并快速发起新的私聊会话</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <div class="field field-quiet new-friends-search-field">
        <span>查找联系人</span>
        <input
          :value="keyword"
          placeholder="搜索账号、昵称或简介"
          @input="$emit('update:keyword', $event.target.value)"
        />
      </div>

      <div class="new-friends-list">
        <div v-if="hint" class="new-friends-banner" :class="`is-${hintTone || 'info'}`">
          {{ hint }}
        </div>

        <section v-if="recentContacts.length" class="new-friends-group">
          <div class="new-friends-group-head">
            <strong>最近联系</strong>
            <span>{{ recentContacts.length }}</span>
          </div>
          <article v-for="contact in recentContacts" :key="`recent:${contact.id}`" class="new-friends-item is-recent">
            <div class="new-friends-avatar">
              <AvatarImage :src="contact.avatarUrl" alt="">
                <span>{{ contact.name.slice(0, 2).toUpperCase() }}</span>
              </AvatarImage>
            </div>
            <div class="new-friends-copy">
              <strong>{{ contact.name }}</strong>
              <p>{{ contact.bio || "最近聊过的联系人" }}</p>
            </div>
            <button class="ghost-btn compact-btn" type="button" @click="$emit('start-chat', contact.id)">
              继续聊天
            </button>
          </article>
        </section>

        <section v-if="incomingRequests.length" class="new-friends-group">
          <div class="new-friends-group-head">
            <strong>收到的好友申请</strong>
            <span>{{ incomingRequests.length }}</span>
          </div>
          <article v-for="contact in incomingRequests" :key="`incoming:${contact.id}`" class="new-friends-item">
            <div class="new-friends-avatar">
              <AvatarImage :src="contact.avatarUrl" alt="">
                <span>{{ contact.name.slice(0, 2).toUpperCase() }}</span>
              </AvatarImage>
            </div>
            <div class="new-friends-copy">
              <strong>{{ contact.name }}</strong>
              <p>{{ contact.bio || "向你发来了好友申请" }}</p>
            </div>
            <div class="new-friends-actions">
              <button class="ghost-btn compact-btn" type="button" @click="$emit('reject-request', contact.request?.id)">
                拒绝
              </button>
              <button class="primary-btn compact-btn" type="button" @click="$emit('accept-request', contact.request?.id)">
                通过
              </button>
            </div>
          </article>
        </section>

        <section v-if="outgoingRequests.length" class="new-friends-group">
          <div class="new-friends-group-head">
            <strong>已发送申请</strong>
            <span>{{ outgoingRequests.length }}</span>
          </div>
          <article v-for="contact in outgoingRequests" :key="`outgoing:${contact.id}`" class="new-friends-item">
            <div class="new-friends-avatar">
              <AvatarImage :src="contact.avatarUrl" alt="">
                <span>{{ contact.name.slice(0, 2).toUpperCase() }}</span>
              </AvatarImage>
            </div>
            <div class="new-friends-copy">
              <strong>{{ contact.name }}</strong>
              <p>{{ contact.bio || "等待对方处理你的好友申请" }}</p>
            </div>
            <div class="new-friends-actions">
              <span class="new-friends-tag">等待通过</span>
              <button class="ghost-btn compact-btn" type="button" @click="$emit('cancel-request', contact.request?.id)">
                取消
              </button>
            </div>
          </article>
        </section>

        <section class="new-friends-group">
          <div class="new-friends-group-head">
            <strong>推荐添加</strong>
            <span>{{ recommendedUsers.length }}</span>
          </div>
          <div v-if="loading" class="empty-state">正在搜索联系人...</div>
          <div v-else-if="!recommendedUsers.length && !friendContacts.length" class="empty-state">没有匹配的联系人</div>
          <article v-for="contact in recommendedUsers" :key="`candidate:${contact.id}`" class="new-friends-item">
            <div class="new-friends-avatar">
              <AvatarImage :src="contact.avatarUrl" alt="">
                <span>{{ contact.name.slice(0, 2).toUpperCase() }}</span>
              </AvatarImage>
            </div>
            <div class="new-friends-copy">
              <strong>{{ contact.name }}</strong>
              <p>{{ contact.bio || "这个人还没有留下签名" }}</p>
            </div>
            <button class="primary-btn compact-btn" type="button" @click="$emit('send-request', contact.id)">
              添加好友
            </button>
          </article>
        </section>

        <section v-if="friendContacts.length" class="new-friends-group">
          <div class="new-friends-group-head">
            <strong>已是好友</strong>
            <span>{{ friendContacts.length }}</span>
          </div>
          <article v-for="contact in friendContacts" :key="`friend:${contact.id}`" class="new-friends-item">
            <div class="new-friends-avatar">
              <AvatarImage :src="contact.avatarUrl" alt="">
                <span>{{ contact.name.slice(0, 2).toUpperCase() }}</span>
              </AvatarImage>
            </div>
            <div class="new-friends-copy">
              <strong>{{ contact.name }}</strong>
              <p>{{ contact.originalName && contact.originalName !== contact.name ? `${contact.originalName}${contact.bio ? ` · ${contact.bio}` : ""}` : (contact.bio || '已在你的好友列表中') }}</p>
            </div>
            <div class="new-friends-actions">
              <button class="ghost-btn compact-btn" type="button" @click="$emit('edit-friend', contact)">
                备注
              </button>
              <button class="ghost-btn compact-btn" type="button" @click="$emit('remove-friend', contact.id)">
                删除
              </button>
              <button class="ghost-btn compact-btn" type="button" @click="$emit('start-chat', contact.id)">
                继续聊天
              </button>
            </div>
          </article>
        </section>
      </div>
    </section>
  </div>
</template>

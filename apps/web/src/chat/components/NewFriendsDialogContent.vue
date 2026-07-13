<script setup>
import NewFriendsContactRow from "./NewFriendsContactRow.vue";
import NewFriendsDialogSection from "./NewFriendsDialogSection.vue";
import { newFriendsDialogEmits, newFriendsDialogProps } from "./new-friends-dialog-contract.js";

defineProps(newFriendsDialogProps);
defineEmits(newFriendsDialogEmits.filter((eventName) => eventName !== "close"));
</script>

<template>
  <div class="field field-quiet new-friends-search-field">
    <span>查找联系人</span>
    <input :value="keyword" placeholder="搜索账号、昵称或简介" @input="$emit('update:keyword', $event.target.value)" />
  </div>

  <div class="new-friends-list">
    <div v-if="hint" class="new-friends-banner" :class="`is-${hintTone || 'info'}`">{{ hint }}</div>

    <NewFriendsDialogSection v-if="recentContacts.length" title="最近联系" :count="recentContacts.length">
      <NewFriendsContactRow v-for="contact in recentContacts" :key="`recent:${contact.id}`" :contact="contact" :description="contact.bio || '最近聊过的联系人'" recent>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('start-chat', contact.id)">继续聊天</button>
      </NewFriendsContactRow>
    </NewFriendsDialogSection>

    <NewFriendsDialogSection v-if="incomingRequests.length" title="收到的好友申请" :count="incomingRequests.length">
      <NewFriendsContactRow v-for="contact in incomingRequests" :key="`incoming:${contact.id}`" :contact="contact" :description="contact.requestMessage || contact.bio || '向你发来了好友申请'">
        <div class="new-friends-actions">
          <button class="ghost-btn compact-btn" type="button" :disabled="contact.requestBusy" @click="$emit('reject-request', contact.request?.id)">{{ contact.requestBusy ? "处理中..." : "拒绝" }}</button>
          <button class="primary-btn compact-btn" type="button" :disabled="contact.requestBusy" @click="$emit('accept-request', contact.request?.id)">{{ contact.requestBusy ? "处理中..." : "通过" }}</button>
        </div>
      </NewFriendsContactRow>
    </NewFriendsDialogSection>

    <NewFriendsDialogSection v-if="outgoingRequests.length" title="已发送申请" :count="outgoingRequests.length">
      <NewFriendsContactRow v-for="contact in outgoingRequests" :key="`outgoing:${contact.id}`" :contact="contact" :description="contact.requestMessage || contact.bio || '等待对方处理你的好友申请'">
        <div class="new-friends-actions">
          <span class="new-friends-tag">等待通过</span>
          <button class="ghost-btn compact-btn" type="button" :disabled="contact.requestBusy" @click="$emit('cancel-request', contact.request?.id)">{{ contact.requestBusy ? "处理中..." : "取消" }}</button>
        </div>
      </NewFriendsContactRow>
    </NewFriendsDialogSection>

    <NewFriendsDialogSection title="推荐添加" :count="recommendedUsers.length">
      <div v-if="loading" class="empty-state">正在搜索联系人...</div>
      <div v-else-if="!recommendedUsers.length && !friendContacts.length" class="empty-state">没有匹配的联系人</div>
      <NewFriendsContactRow v-for="contact in recommendedUsers" :key="`candidate:${contact.id}`" :contact="contact" :description="contact.bio || '这个人还没有留下签名'">
        <button class="primary-btn compact-btn" type="button" :disabled="!contact.canSendRequest" @click="$emit('send-request', contact.id)">{{ contact.sendingRequest ? "发送中..." : "添加好友" }}</button>
      </NewFriendsContactRow>
    </NewFriendsDialogSection>

    <NewFriendsDialogSection v-if="friendContacts.length" title="已是好友" :count="friendContacts.length">
      <NewFriendsContactRow v-for="contact in friendContacts" :key="`friend:${contact.id}`" :contact="contact" :description="contact.originalName && contact.originalName !== contact.name ? `${contact.originalName}${contact.bio ? ` · ${contact.bio}` : ''}` : (contact.bio || '已在你的好友列表中')">
        <div class="new-friends-actions">
          <button class="ghost-btn compact-btn" type="button" @click="$emit('edit-friend', contact)">备注</button>
          <button class="ghost-btn compact-btn" type="button" :disabled="!contact.canRemoveFriend" @click="$emit('remove-friend', contact.id)">{{ contact.removingFriend ? "删除中..." : "删除" }}</button>
          <button class="ghost-btn compact-btn" type="button" @click="$emit('start-chat', contact.id)">继续聊天</button>
        </div>
      </NewFriendsContactRow>
    </NewFriendsDialogSection>
  </div>
</template>

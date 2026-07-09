import { computed, ref } from "vue";
import { escapeHtml, formatDateTime, formatExpiry, formatFileSize, getInitials } from "../../shared/utils.js";

export function useChatStore(auth) {
  const me = ref(null);
  const contacts = ref([]);
  const conversations = ref([]);
  const selectedId = ref("");
  const participants = ref([]);
  const messages = ref([]);
  const hasMoreMessages = ref(false);
  const loadingMoreMessages = ref(false);
  const replyTo = ref(null);
  const editingMessageId = ref("");
  const mentionOpen = ref(false);
  const mentionStart = ref(-1);
  const mentionKeyword = ref("");
  const mentionOptions = ref([]);
  const searchKeyword = ref("");
  const socketOnline = ref(false);
  const conversationKeyword = ref("");
  const messageKeyword = ref("");
  const messageInput = ref("");
  const uploadingFiles = ref(false);
  const composerHint = ref("");
  const composerHintTone = ref("");
  const profileName = ref("");
  const profileBio = ref("");
  const profileHint = ref("");
  const profileHintTone = ref("");

  const meName = computed(() => me.value?.profile?.realName || auth.userId || "未登录");
  const meMeta = computed(() => auth.userId + (me.value?.role ? ` · ${me.value.role}` : ""));
  const meAvatar = computed(() => getInitials(meName.value, auth.userId));
  const meAvatarUrl = computed(() => me.value?.profile?.avatarUrl || "");

  const selectedConversation = computed(() => conversations.value.find((item) => item.id === selectedId.value) || null);

  const filteredConversations = computed(() => {
    const keyword = conversationKeyword.value.trim().toLowerCase();
    return conversations.value
      .map((row) => ({
        ...row,
        avatarUrl: row.kind === "direct"
          ? ((row.participants || []).find((item) => item.id !== auth.userId)?.profile?.avatarUrl || "")
          : "",
        preview: row.lastMessage
          ? (
            row.lastMessage.deletedAt
              ? "消息已删除"
              : row.lastMessage.type === "announcement"
                ? `【公告】${row.lastMessage.content || ""}`
                : row.lastMessage.type === "file"
                  ? (row.lastMessage.content || "[文件消息]")
                  : (row.lastMessage.content || "[空消息]")
          )
          : "暂无消息",
      }))
      .filter((row) => {
        if (!keyword) return true;
        const title = String(row.title || row.roomKey || "").toLowerCase();
        const preview = String(row.preview || "").toLowerCase();
        return title.includes(keyword) || preview.includes(keyword);
      });
  });

  const chatTitle = computed(() => selectedConversation.value?.title || selectedConversation.value?.roomKey || "请选择会话");
  const chatSubtitle = computed(() => (
    selectedConversation.value
      ? `${selectedConversation.value.kind || "group"} · ${selectedConversation.value.roomKey || ""}`
      : "登录后可查看你已加入的会话。"
  ));

  const renderedMessages = computed(() => messages.value.map((message) => {
      const senderName = message.sender?.profile?.realName || message.senderId || "未知用户";
    const deleted = Boolean(message.deletedAt);
    const isFileMessage = Array.isArray(message.files) && message.files.length > 0;
    let html = deleted ? "<em>消息已删除</em>" : escapeHtml(message.content || "");

    participants.value.forEach((user) => {
      const name = user.profile?.realName || "";
      if (!name) return;
      const token = `@${name}`;
      html = html.split(escapeHtml(token)).join(`<span class="mention">${escapeHtml(token)}</span>`);
    });

    return {
      ...message,
      senderName,
      isFileMessage,
      isMe: String(message.senderId) === String(auth.userId),
      canEdit: String(message.senderId) === String(auth.userId) && !deleted && message.type === "text" && !isFileMessage,
      canDelete: String(message.senderId) === String(auth.userId) && !deleted,
      timeText: formatDateTime(message.createdAt),
      html,
      files: isFileMessage
        ? message.files.map((file) => ({
            ...file,
            metaText: `${formatFileSize(file.size)} · ${(file.mimeType || "file").split("/").pop()?.toUpperCase() || "FILE"}`,
            expiryText: formatExpiry(file.expiresAt),
          }))
        : [],
      replyToText: message.replyTo
        ? `回复 ${message.replyTo.senderId || ""}：${
          message.replyTo.content
          || (Array.isArray(message.replyTo.files) && message.replyTo.files.length
            ? message.replyTo.files.map((file) => file.name || "附件").join("、")
            : "")
        }`
        : "",
      avatarUrl: message.sender?.profile?.avatarUrl || "",
    };
  }));

  const showReplyBar = computed(() => Boolean(editingMessageId.value || replyTo.value));
  const replyText = computed(() => {
    if (editingMessageId.value) return "正在编辑消息，发送后会覆盖原内容。";
    if (replyTo.value) {
      return `回复 ${replyTo.value.sender?.profile?.realName || replyTo.value.senderId}：${replyTo.value.content || ""}`;
    }
    return "";
  });

  const searchResultText = computed(() => (
    searchKeyword.value ? `搜索结果：${searchKeyword.value}（${messages.value.length} 条）` : ""
  ));

  function setComposerHint(message, tone = "") {
    composerHint.value = message || "";
    composerHintTone.value = tone;
  }

  function clearReplyState() {
    editingMessageId.value = "";
    replyTo.value = null;
  }

  function collectMentionIds(content) {
    return participants.value
      .filter((user) => content.includes(`@${user.profile.realName || user.id}`))
      .map((user) => user.id);
  }

  function updateMentionState(nextValue = messageInput.value) {
    const cursor = nextValue.length;
    const head = nextValue.slice(0, cursor);
    const match = head.match(/(^|\s)@([A-Za-z0-9_\-\u4e00-\u9fa5]*)$/);
    if (!match) {
      mentionOpen.value = false;
      mentionOptions.value = [];
      return;
    }

    mentionOpen.value = true;
    mentionKeyword.value = match[2] || "";
    mentionStart.value = cursor - mentionKeyword.value.length - 1;
    mentionOptions.value = participants.value.filter((user) => {
      const name = String(user.profile?.realName || "").toLowerCase();
      return !mentionKeyword.value || name.includes(mentionKeyword.value.toLowerCase());
    });
  }

  function applyMention(userId) {
    const user = participants.value.find((item) => item.id === userId);
    if (!user) return;
    const before = messageInput.value.slice(0, mentionStart.value);
    messageInput.value = `${before}@${user.profile.realName || user.id} `;
    mentionOpen.value = false;
    mentionOptions.value = [];
  }

  function resetComposer() {
    messageInput.value = "";
    mentionOpen.value = false;
    mentionOptions.value = [];
    setComposerHint("", "");
    searchKeyword.value = "";
    messageKeyword.value = "";
  }

  return {
    me,
    contacts,
    conversations,
    selectedId,
    participants,
    messages,
    hasMoreMessages,
    loadingMoreMessages,
    replyTo,
    editingMessageId,
    mentionOpen,
    mentionStart,
    mentionKeyword,
    mentionOptions,
    searchKeyword,
    socketOnline,
    conversationKeyword,
    messageKeyword,
    messageInput,
    uploadingFiles,
    composerHint,
    composerHintTone,
    profileName,
    profileBio,
    profileHint,
    profileHintTone,
    meName,
    meMeta,
    meAvatar,
    meAvatarUrl,
    selectedConversation,
    filteredConversations,
    chatTitle,
    chatSubtitle,
    renderedMessages,
    showReplyBar,
    replyText,
    searchResultText,
    setComposerHint,
    clearReplyState,
    collectMentionIds,
    updateMentionState,
    applyMention,
    resetComposer,
  };
}

import { appendAppLog } from "../../shared/app-log.js";

export function createChatConversationCreateActions({ store, chatApi, dataActions }) {
  async function openOrCreateDirectConversation(peerId, selectConversation) {
    const targetPeerId = String(peerId || "").trim();
    if (!targetPeerId) return "";
    const payload = await chatApi.postJson("/api/v1/conversations", {
      kind: "direct",
      peerId: targetPeerId,
    });
    const conversationId = String(payload.data?.id || "");
    if (!conversationId) return "";
    store.selectedId.value = conversationId;
    await dataActions.loadConversations();
    await selectConversation(conversationId);
    return conversationId;
  }

  function createDirectConversation() {
    if (!store.contacts.value.length) {
      store.setComposerHint("当前没有可发起私聊的联系人", "error");
      store.pushNotification({ title: "无法发起私聊", message: "当前没有可用联系人。", tone: "error" });
      return;
    }
    store.openCreateDialog("direct");
  }

  function createGroupConversation() {
    if (!store.contacts.value.length) {
      store.setComposerHint("当前没有可选联系人", "error");
      store.pushNotification({ title: "无法创建群聊", message: "当前没有可选成员。", tone: "error" });
      return;
    }
    store.openCreateDialog("group");
  }

  async function submitCreateConversation() {
    store.createDialogSubmitting.value = true;
    store.setCreateDialogHint("", "");
    try {
      if (store.createDialogMode.value === "direct") {
        const peerId = store.selectedPeerId.value.trim();
        if (!peerId) {
          store.setCreateDialogHint("请选择一个联系人", "error");
          return;
        }
        const payload = await chatApi.postJson("/api/v1/conversations", { kind: "direct", peerId });
        store.selectedId.value = payload.data?.id || store.selectedId.value;
        store.pushNotification({ title: "私聊已创建", message: "可以开始发送消息了。", tone: "success" });
        appendAppLog({ level: "info", category: "conversation", message: `已创建私聊：${peerId}` });
      } else {
        const title = store.createDialogTitle.value.trim();
        if (!title) {
          store.setCreateDialogHint("请输入群聊名称", "error");
          return;
        }
        if (store.createDialogParticipantIds.value.length < 2) {
          store.setCreateDialogHint("至少选择两位成员", "error");
          return;
        }
        const payload = await chatApi.postJson("/api/v1/conversations", {
          kind: "group",
          title,
          participantIds: store.createDialogParticipantIds.value,
        });
        store.selectedId.value = payload.data?.id || store.selectedId.value;
        store.pushNotification({ title: "群聊已创建", message: `“${title}” 已准备就绪。`, tone: "success" });
        appendAppLog({ level: "info", category: "conversation", message: `已创建群聊：${title}` });
      }
      store.closeCreateDialog();
      await dataActions.refreshAll();
    } catch (error) {
      store.setCreateDialogHint(error?.message || "创建会话失败", "error");
      store.pushNotification({ title: "创建失败", message: error?.message || "创建会话失败", tone: "error" });
    } finally {
      store.createDialogSubmitting.value = false;
    }
  }

  return {
    createDirectConversation,
    createGroupConversation,
    openOrCreateDirectConversation,
    submitCreateConversation,
  };
}

import { chatApi } from "../../shared/api-client.js";
import { getCurrentGroupId, reloadGroupConversation } from "./group-management-shared.js";

export function useGroupMemberActions(store, actions) {
  async function renameGroup(title) {
    const conversationId = getCurrentGroupId(store);
    if (!conversationId) return;
    const nextTitle = String(title || "").trim();
    if (!nextTitle) {
      store.setComposerHint("请输入群聊名称", "error");
      return;
    }
    await chatApi.patchJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/group`, { title: nextTitle });
    await reloadGroupConversation(store, actions, conversationId);
    store.pushNotification({ title: "群名称已更新", message: nextTitle, tone: "success", ttl: 1800 });
  }

  function requestLeaveGroup() {
    const conversation = store.selectedConversation.value;
    const conversationId = getCurrentGroupId(store);
    if (!conversationId) return;
    store.openConfirmDialog({
      title: "退出群聊",
      message: `退出“${conversation?.title || "当前群聊"}”后，你将不再接收这个群的消息。`,
      confirmText: "退出群聊",
      action: async () => {
        await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/leave`, {});
        await reloadGroupConversation(store, actions, "");
        store.pushNotification({ title: "已退出群聊", message: conversation?.title || "当前群聊", tone: "success", ttl: 1800 });
      },
    });
  }

  function requestRemoveMember(member) {
    const conversationId = getCurrentGroupId(store);
    if (!conversationId || !member?.id) return;
    const memberName = member.friendAlias || member.profile?.realName || member.id;
    store.openConfirmDialog({
      title: "移除群成员",
      message: `确认将“${memberName}”移出当前群聊吗？`,
      confirmText: "移除成员",
      action: async () => {
        await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(member.id)}`);
        await reloadGroupConversation(store, actions, conversationId);
        store.pushNotification({ title: "成员已移除", message: memberName, tone: "success", ttl: 1800 });
      },
    });
  }

  return {
    renameGroup,
    requestLeaveGroup,
    requestRemoveMember,
  };
}

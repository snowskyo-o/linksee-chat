import { chatApi } from "../../shared/api-client.js";

export function useFriendCenterActions(state, callbacks = {}) {
  async function runWithRefresh(action, task, fallbackMessage, rethrow = false) {
    if (!action.key || state.isPending(action.key)) return;
    state.setPending(action.key, true);
    state.setHint("", "");
    try {
      await task();
      if (action.successMessage) state.setHint(action.successMessage, "success");
      await action.refresh();
      if (typeof callbacks.onChanged === "function") await callbacks.onChanged();
    } catch (error) {
      state.setHint(error?.message || fallbackMessage, "error");
      if (rethrow) throw error;
    } finally {
      state.setPending(action.key, false);
    }
  }

  async function sendRequest(userId, refresh) {
    await runWithRefresh(
      { key: `send:${userId}`, refresh, successMessage: "好友申请已发送" },
      () => chatApi.postJson("/api/v1/friends/requests", { receiverId: userId, message: "" }),
      "发送好友申请失败",
    );
  }

  async function resolveRequest(requestId, action, successMessage, refresh) {
    await runWithRefresh(
      { key: `request:${requestId}`, refresh, successMessage },
      () => chatApi.patchJson(`/api/v1/friends/requests/${encodeURIComponent(requestId)}`, { action }),
      "处理好友请求失败",
    );
  }

  async function updateAlias(userId, alias, refresh) {
    await runWithRefresh(
      { key: `alias:${userId}`, refresh, successMessage: "好友备注已更新" },
      () => chatApi.patchJson(`/api/v1/friends/${encodeURIComponent(userId)}/alias`, { alias }),
      "更新备注失败",
      true,
    );
  }

  async function removeFriend(userId, refresh) {
    await runWithRefresh(
      { key: `remove:${userId}`, refresh, successMessage: "已删除联系人" },
      () => chatApi.delete(`/api/v1/friends/${encodeURIComponent(userId)}`),
      "删除联系人失败",
      true,
    );
  }

  return {
    sendRequest,
    resolveRequest,
    updateAlias,
    removeFriend,
  };
}

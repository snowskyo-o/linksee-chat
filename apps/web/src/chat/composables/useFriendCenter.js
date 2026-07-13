import { ref } from "vue";
import { chatApi } from "../../shared/api-client.js";
import { includesFriendCenterKeyword } from "./friend-center-utils.js";
import { useFriendCenterActions } from "./useFriendCenterActions.js";
import { useFriendCenterDerivedState } from "./useFriendCenterDerivedState.js";

export function useFriendCenter(store, callbacks = {}) {
  const open = ref(false);
  const keyword = ref("");
  const loading = ref(false);
  const hint = ref("");
  const hintTone = ref("");
  const discovery = ref([]);
  const requests = ref([]);
  const pendingActions = ref([]);
  const setHint = (message = "", tone = "") => { hint.value = message; hintTone.value = tone; };
  const isPending = (key) => pendingActions.value.includes(String(key));
  const setPending = (key, active) => {
    const value = String(key);
    pendingActions.value = active
      ? [...new Set([...pendingActions.value, value])]
      : pendingActions.value.filter((item) => item !== value);
  };

  async function refresh() {
    loading.value = true;
    try {
      const query = keyword.value.trim();
      const [discoveryPayload, requestPayload] = await Promise.all([
        chatApi.getJson(`/api/v1/friends/discovery?q=${encodeURIComponent(query)}`),
        chatApi.getJson("/api/v1/friends/requests"),
      ]);
      discovery.value = Array.isArray(discoveryPayload?.data) ? discoveryPayload.data : [];
      requests.value = Array.isArray(requestPayload?.data) ? requestPayload.data : [];
    } catch (error) {
      setHint(error?.message || "加载好友中心失败", "error");
    } finally {
      loading.value = false;
    }
  }

  const derived = useFriendCenterDerivedState(store, { discovery, requests, isPending });
  const actions = useFriendCenterActions({ isPending, setPending, setHint }, callbacks);

  return {
    open,
    keyword,
    loading,
    hint,
    hintTone,
    ...derived,
    refresh,
    openCenter() { open.value = true; setHint("", ""); return refresh(); },
    closeCenter() { open.value = false; },
    openDirectChat(userId) {
      if (!userId) return;
      open.value = false;
      store.openCreateDialog("direct");
      store.createDialogPeerId.value = String(userId);
    },
    sendRequest(userId) { return userId ? actions.sendRequest(userId, refresh) : undefined; },
    resolveRequest(requestId, action, successMessage) {
      return requestId ? actions.resolveRequest(requestId, action, successMessage, refresh) : undefined;
    },
    updateAlias(userId, alias) { return userId ? actions.updateAlias(String(userId).trim(), alias, refresh) : undefined; },
    removeFriend(userId) { return userId ? actions.removeFriend(String(userId).trim(), refresh) : undefined; },
    includesKeyword: includesFriendCenterKeyword,
    isPending,
  };
}

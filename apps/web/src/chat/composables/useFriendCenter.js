import { computed, ref } from "vue";
import { chatApi } from "../../shared/api-client.js";

function normalizePerson(user) {
  return {
    id: String(user?.id || ""),
    name: user?.profile?.realName || user?.id || "未命名用户",
    originalName: user?.profile?.originalRealName || user?.profile?.realName || user?.id || "",
    friendAlias: user?.friendAlias || "",
    bio: user?.profile?.bio || "",
    avatarUrl: user?.profile?.avatarUrl || "",
  };
}

function includesKeyword(keyword, ...values) {
  const search = String(keyword || "").trim().toLowerCase();
  if (!search) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(search));
}

export function useFriendCenter(store, callbacks = {}) {
  const open = ref(false);
  const keyword = ref("");
  const loading = ref(false);
  const hint = ref("");
  const hintTone = ref("");
  const discovery = ref([]);
  const requests = ref([]);
  const pendingActions = ref([]);

  const contactMap = computed(() => new Map(
    store.createDialogContacts.value.map((contact) => [String(contact.id), contact]),
  ));

  const discoveryRows = computed(() => discovery.value.map((item) => {
    const person = normalizePerson(item?.user);
    const fallbackContact = contactMap.value.get(person.id);
    return {
      id: person.id,
      name: fallbackContact?.name || person.name,
      originalName: fallbackContact?.realName || person.originalName,
      friendAlias: fallbackContact?.friendAlias || person.friendAlias,
      bio: fallbackContact?.bio || person.bio,
      avatarUrl: fallbackContact?.avatarUrl || person.avatarUrl,
      relation: item?.relation || "none",
      request: item?.request || null,
    };
  }));

  const recentContacts = computed(() => {
    const usedTitles = new Set(
      store.conversationRows.value
        .filter((row) => row.kind === "direct")
        .map((row) => row.displayTitle),
    );

    return discoveryRows.value
      .filter((row) => row.relation === "friend" && usedTitles.has(row.name))
      .slice(0, 4);
  });

  const incomingRequests = computed(() => discoveryRows.value.filter((row) => row.relation === "incoming_pending"));
  const outgoingRequests = computed(() => discoveryRows.value.filter((row) => row.relation === "outgoing_pending"));
  const recommendedUsers = computed(() => discoveryRows.value.filter((row) => (
    row.relation === "none" || row.relation === "rejected" || row.relation === "canceled"
  )));
  const friendContacts = computed(() => discoveryRows.value.filter((row) => row.relation === "friend"));

  function setHint(message = "", tone = "") {
    hint.value = message;
    hintTone.value = tone;
  }

  function isPending(key) {
    return pendingActions.value.includes(String(key));
  }

  function setPending(key, active) {
    const value = String(key);
    pendingActions.value = active
      ? [...new Set([...pendingActions.value, value])]
      : pendingActions.value.filter((item) => item !== value);
  }

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

  async function sendRequest(userId) {
    if (!userId || isPending(`send:${userId}`)) return;
    setPending(`send:${userId}`, true);
    setHint("", "");
    try {
      await chatApi.postJson("/api/v1/friends/requests", { receiverId: userId, message: "" });
      setHint("好友申请已发送", "success");
      await refresh();
      if (typeof callbacks.onChanged === "function") await callbacks.onChanged();
    } catch (error) {
      setHint(error?.message || "发送好友申请失败", "error");
    } finally {
      setPending(`send:${userId}`, false);
    }
  }

  async function resolveRequest(requestId, action, successMessage) {
    if (!requestId || isPending(`request:${requestId}`)) return;
    setPending(`request:${requestId}`, true);
    setHint("", "");
    try {
      await chatApi.patchJson(`/api/v1/friends/requests/${encodeURIComponent(requestId)}`, { action });
      setHint(successMessage, "success");
      await refresh();
      if (typeof callbacks.onChanged === "function") await callbacks.onChanged();
    } catch (error) {
      setHint(error?.message || "处理好友请求失败", "error");
    } finally {
      setPending(`request:${requestId}`, false);
    }
  }

  async function updateAlias(userId, alias) {
    const targetUserId = String(userId || "").trim();
    if (!targetUserId || isPending(`alias:${targetUserId}`)) return;
    setPending(`alias:${targetUserId}`, true);
    setHint("", "");
    try {
      await chatApi.patchJson(`/api/v1/friends/${encodeURIComponent(targetUserId)}/alias`, { alias });
      setHint("好友备注已更新", "success");
      await refresh();
      if (typeof callbacks.onChanged === "function") await callbacks.onChanged();
    } catch (error) {
      setHint(error?.message || "更新备注失败", "error");
      throw error;
    } finally {
      setPending(`alias:${targetUserId}`, false);
    }
  }

  async function removeFriend(userId) {
    const targetUserId = String(userId || "").trim();
    if (!targetUserId || isPending(`remove:${targetUserId}`)) return;
    setPending(`remove:${targetUserId}`, true);
    setHint("", "");
    try {
      await chatApi.delete(`/api/v1/friends/${encodeURIComponent(targetUserId)}`);
      setHint("已删除联系人", "success");
      await refresh();
      if (typeof callbacks.onChanged === "function") await callbacks.onChanged();
    } catch (error) {
      setHint(error?.message || "删除联系人失败", "error");
      throw error;
    } finally {
      setPending(`remove:${targetUserId}`, false);
    }
  }

  function openDirectChat(userId) {
    if (!userId) return;
    open.value = false;
    store.openCreateDialog("direct");
    store.createDialogPeerId.value = String(userId);
  }

  function openCenter() {
    open.value = true;
    setHint("", "");
    return refresh();
  }

  function closeCenter() {
    open.value = false;
  }

  const requestTotal = computed(() => requests.value.filter((item) => item?.status === "pending").length);

  return {
    open,
    keyword,
    loading,
    hint,
    hintTone,
    requestTotal,
    recentContacts,
    incomingRequests,
    outgoingRequests,
    recommendedUsers,
    friendContacts,
    refresh,
    openCenter,
    closeCenter,
    openDirectChat,
    sendRequest,
    resolveRequest,
    updateAlias,
    removeFriend,
    includesKeyword,
    isPending,
  };
}

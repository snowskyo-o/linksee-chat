import { chatApi } from "../../shared/api-client.js";
import { appendAppLog } from "../../shared/app-log.js";
import { appendCacheBust } from "../../shared/media.js";
import { createChatDataActions } from "./chat-data-actions.js";
import { createPendingAttachment, dedupeFileList, revokePendingAttachment } from "./file-attachments.js";
import { writeChatCache } from "./local-chat-cache.js";
import {
  buildFileMessageContent,
  buildOptimisticTextMessage,
  findMessage,
  normalizeMessage,
  normalizeUser,
  patchConversationLocally,
  patchMessageLocally,
  patchUserProfileLocally,
  replaceMessageLocally,
  syncConversationPreview,
} from "./message-operations.js";

export function useChatActions(store) {
  const dataActions = createChatDataActions(store, chatApi);
  const cacheUserId = () => store.me.value?.id || localStorage.getItem("chat_user_id") || "guest";
  const dirtyProfileUserIds = new Set();
  const autoReceiveQueue = new Set();

  function persistSidebarCaches() {
    const userId = cacheUserId();
    writeChatCache(userId, "profile", {
      data: store.me.value || {},
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
    writeChatCache(userId, "contacts", {
      data: store.contacts.value || [],
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
    writeChatCache(userId, "conversations", {
      data: store.conversations.value || [],
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
    if (store.selectedId.value) {
      writeChatCache(userId, `participants-${store.selectedId.value}`, {
        data: store.participants.value || [],
        cachedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  function syncCurrentUserProfileLocally(profilePatch) {
    const targetUserId = store.me.value?.id || localStorage.getItem("chat_user_id") || "";
    if (!targetUserId) return;
    applyUserProfileUpdate(targetUserId, profilePatch);
  }

  function applyUserProfileUpdate(userId, profilePatch) {
    const targetUserId = String(userId || "");
    if (!targetUserId) return;
    patchUserProfileLocally(store, targetUserId, profilePatch);
    if (store.me.value) store.me.value = normalizeUser(store.me.value);
    store.contacts.value = store.contacts.value.map((user) => normalizeUser(user));
    store.participants.value = store.participants.value.map((user) => normalizeUser(user));
    if (String(store.me.value?.id || "") === targetUserId) {
      store.profileName.value = store.me.value?.profile?.realName || store.profileName.value;
      store.profileBio.value = store.me.value?.profile?.bio || "";
      document.title = `Linksee Chat · ${store.profileName.value}`;
    }
    persistSidebarCaches();
  }

  function getKnownProfileUsers(userIds = []) {
    const wanted = new Set(userIds.map((id) => String(id || "")).filter(Boolean));
    const byId = new Map();
    const collect = (user) => {
      if (!user?.id) return;
      if (wanted.size && !wanted.has(String(user.id))) return;
      byId.set(String(user.id), user);
    };
    collect(store.me.value);
    store.contacts.value.forEach(collect);
    store.participants.value.forEach(collect);
    store.conversations.value.forEach((conversation) => {
      (conversation.participants || []).forEach(collect);
    });
    store.messages.value.forEach((message) => {
      collect(message.sender);
      collect(message.replyTo?.sender);
    });
    return Array.from(byId.values());
  }

  function markProfileDirty(userId) {
    const targetUserId = String(userId || "");
    if (targetUserId) dirtyProfileUserIds.add(targetUserId);
  }

  async function refreshProfilesIfDirty(userIds = []) {
    const targetIds = userIds.map((id) => String(id || "")).filter(Boolean);
    const ids = targetIds.length
      ? targetIds.filter((id) => dirtyProfileUserIds.has(id))
      : Array.from(dirtyProfileUserIds);
    if (!ids.length) return;

    const items = getKnownProfileUsers(ids).map((user) => ({
      userId: user.id,
      profileVersion: Number(user.profile?.profileVersion || 0),
      avatarVersion: Number(user.profile?.avatarVersion || 0),
    }));
    if (!items.length) return;

    const payload = await chatApi.postJson("/api/v1/users/profiles/check", { items });
    const changed = Array.isArray(payload.data) ? payload.data : [];
    changed.forEach((user) => {
      const profile = user.profile || {};
      applyUserProfileUpdate(user.id, {
        realName: profile.realName,
        originalRealName: profile.originalRealName || profile.realName,
        bio: profile.bio || "",
        avatarUrl: profile.avatarUrl
          ? appendCacheBust(profile.avatarUrl, profile.avatarVersion || Date.now())
          : "",
        profileVersion: Number(profile.profileVersion || 0),
        avatarVersion: Number(profile.avatarVersion || 0),
      });
    });
    ids.forEach((id) => dirtyProfileUserIds.delete(id));
  }

  function queueFiles(fileList) {
    const existing = new Set(store.pendingFiles.value.map((item) => (
      [item.name || "", item.size || 0, item.file?.lastModified || 0].join(":")
    )));
    const nextItems = dedupeFileList(fileList)
      .filter((file) => !existing.has([file.name || "", file.size || 0, file.lastModified || 0].join(":")))
      .map(createPendingAttachment);
    if (!nextItems.length) return;
    store.pendingFiles.value = [...store.pendingFiles.value, ...nextItems];
    store.setComposerHint(`${store.pendingFiles.value.length} 个文件待发送`, "success");
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

  async function openOrCreateDirectConversation(peerId) {
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

  async function selectConversation(conversationId) {
    await dataActions.selectConversation(conversationId);
    await refreshProfilesIfDirty(store.participants.value.map((user) => user.id)).catch(() => {});
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

  function sendAnnouncement() {
    if (store.selectedId.value) store.openAnnouncementDialog();
  }

  async function submitAnnouncement() {
    if (!store.selectedId.value) return;
    const content = store.announcementDraft.value.trim();
    if (!content) {
      store.setAnnouncementHint("请输入公告内容", "error");
      return;
    }
    store.announcementSubmitting.value = true;
    store.setAnnouncementHint("", "");
    try {
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/announcements`, { content });
      store.closeAnnouncementDialog();
      store.setComposerHint("公告已发布", "success");
      store.searchKeyword.value = "";
      store.messageKeyword.value = "";
      await dataActions.refreshAll();
    } catch (error) {
      store.setAnnouncementHint(error?.message || "发布公告失败", "error");
    } finally {
      store.announcementSubmitting.value = false;
    }
  }

  async function postTextMessage(content, mentions, replyTo, optimisticMessage) {
    const payload = await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages`, {
      content,
      mentions,
      replyToId: replyTo ? replyTo.id : null,
    });
    if (payload.data) {
      const normalized = normalizeMessage(payload.data);
      replaceMessageLocally(store, optimisticMessage.id, normalized);
      syncConversationPreview(store, store.selectedId.value, normalized);
    }
  }

  async function submitComposer() {
    if (!store.selectedId.value) return;
    const activeConversationId = store.selectedId.value;
    const content = store.messageInput.value.trim();
    const pendingFiles = store.pendingFiles.value.slice();
    if (!content && !pendingFiles.length) return;
    const mentions = store.collectMentionIds(content);
    const replyTo = store.replyTo.value ? { ...store.replyTo.value } : null;
    if (content) {
      const optimisticMessage = buildOptimisticTextMessage(store, content, mentions, replyTo);
      store.messages.value = [...store.messages.value, optimisticMessage];
      syncConversationPreview(store, store.selectedId.value, optimisticMessage);
      appendAppLog({ level: "info", category: "message", message: "消息进入发送队列", meta: content.slice(0, 80) });
      store.clearReplyState();
      store.resetComposer();
      try {
        await postTextMessage(content, mentions, replyTo, optimisticMessage);
      } catch (error) {
        patchMessageLocally(store, optimisticMessage.id, {
          operationState: "failed",
          sendError: error?.message || "发送失败",
        });
        appendAppLog({ level: "error", category: "message", message: "消息发送失败", meta: error?.message || "" });
        throw error;
      }
    }
    if (pendingFiles.length) {
      await uploadFiles(pendingFiles, { replyTo: content ? null : replyTo });
      if (!content) {
        store.clearReplyState();
        store.resetComposer();
      }
    }
    dataActions.saveConversationDraft(activeConversationId, "").catch(() => {});
    dataActions.loadConversations().catch(() => {});
    dataActions.markConversationReadIfNeeded().catch(() => {});
  }

  async function retryMessage(messageId) {
    const message = findMessage(store, messageId);
    if (!message || message.operationState !== "failed") return;
    patchMessageLocally(store, messageId, { operationState: "sending", sendError: "" });
    try {
      await postTextMessage(message.content || "", message.mentions || [], message.replyTo || null, message);
      appendAppLog({ level: "info", category: "message", message: "消息重试发送成功", meta: (message.content || "").slice(0, 80) });
    } catch (error) {
      patchMessageLocally(store, messageId, {
        operationState: "failed",
        sendError: error?.message || "发送失败",
      });
      appendAppLog({ level: "error", category: "message", message: "消息重试失败", meta: error?.message || "" });
      throw error;
    }
  }

  async function uploadFiles(fileList, options = {}) {
    if (!store.selectedId.value) return;
    const rawItems = Array.from(fileList || []).filter(Boolean);
    const pendingItems = rawItems.filter((item) => item?.file);
    const entries = dedupeFileList(pendingItems.length ? pendingItems.map((item) => item.file) : rawItems)
      .map((file) => {
        const pendingItem = pendingItems.find((item) => item.file === file)
          || pendingItems.find((item) => (
            [item.file?.name || "", item.file?.size || 0, item.file?.lastModified || 0].join(":")
              === [file.name || "", file.size || 0, file.lastModified || 0].join(":")
          ));
        return { file, pendingItem };
      });
    if (!entries.length) return;
    const targetPendingIds = entries.map((entry) => entry.pendingItem?.id).filter(Boolean);
    store.uploadingFiles.value = true;
    store.uploadProgress.value = 0;
    store.uploadFileName.value = entries[0]?.file?.name || "";
    store.setComposerHint(`正在上传 ${entries.length} 个文件...`, "");
    appendAppLog({ level: "info", category: "file", message: `开始上传 ${entries.length} 个文件` });
    targetPendingIds.forEach((id) => {
      store.updatePendingFile(id, {
        uploadStatus: "uploading",
        uploadProgress: 0,
        uploadError: "",
      });
    });
    try {
      const uploadedFiles = [];
      for (let index = 0; index < entries.length; index += 1) {
        const { file, pendingItem } = entries[index];
        store.uploadFileName.value = file.name || `file-${index + 1}`;
        const base = Math.floor((index / entries.length) * 100);
        const updateProgress = ({ percent }) => {
          const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));
          const scaled = Math.min(100, Math.floor(((index + safePercent / 100) / entries.length) * 100));
          store.uploadProgress.value = Math.max(base, scaled);
          if (pendingItem?.id) {
            store.updatePendingFile(pendingItem.id, {
              uploadStatus: "uploading",
              uploadProgress: Math.floor(safePercent),
              uploadError: "",
            });
          }
        };
        try {
          const presign = await chatApi.postJson("/api/v1/chat/files/presign-upload", {
            conversationId: store.selectedId.value,
            fileName: file.name || "attachment",
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          });
          const data = presign.data || {};
          await chatApi.putExternal(
            data.uploadUrl,
            file,
            data.headers || { "Content-Type": file.type || "application/octet-stream" },
            updateProgress,
          );
          uploadedFiles.push({
            name: file.name || "attachment",
            objectKey: data.objectKey,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            uploadedAt: new Date().toISOString(),
          });
        } catch (error) {
          appendAppLog({ level: "warn", category: "file", message: "预签名上传失败，切换到服务端直传", meta: error?.message || "" });
          const payload = await chatApi.postBinary("/api/v1/chat/files/upload-direct", file, {
            "Content-Type": file.type || "application/octet-stream",
            "X-Conversation-Id": store.selectedId.value,
            "X-File-Name": encodeURIComponent(file.name || "attachment"),
            "X-File-Size": String(file.size || 0),
          });
          updateProgress({ percent: 100 });
          uploadedFiles.push(payload.data || {
            name: file.name || "attachment",
            size: file.size,
            mimeType: file.type || "application/octet-stream",
          });
        }
        if (pendingItem?.id) {
          store.updatePendingFile(pendingItem.id, {
            uploadStatus: "uploading",
            uploadProgress: 100,
            uploadError: "",
          });
        }
      }
      store.uploadProgress.value = 100;
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages`, {
        type: "file",
        content: buildFileMessageContent(uploadedFiles),
        files: uploadedFiles,
        mentions: [],
        replyToId: options.replyTo ? options.replyTo.id : (store.replyTo.value ? store.replyTo.value.id : null),
      });
      store.clearReplyState();
      store.setComposerHint(`已上传 ${uploadedFiles.length} 个文件`, "success");
      appendAppLog({ level: "info", category: "file", message: `上传完成 ${uploadedFiles.length} 个文件` });
      if (targetPendingIds.length) store.removePendingFiles(targetPendingIds);
      await dataActions.refreshSelectedConversation();
      await dataActions.loadConversations();
      await dataActions.markConversationReadIfNeeded().catch(() => {});
    } catch (error) {
      targetPendingIds.forEach((id) => {
        store.updatePendingFile(id, {
          uploadStatus: "failed",
          uploadError: error?.message || "上传失败",
        });
      });
      store.setComposerHint(error?.message || "上传失败", "error");
      appendAppLog({ level: "error", category: "file", message: "文件上传失败", meta: error?.message || "" });
      throw error;
    } finally {
      store.uploadingFiles.value = false;
      store.uploadProgress.value = 0;
      store.uploadFileName.value = "";
    }
  }

  async function downloadFile(file, options = {}) {
    if (!file?.objectKey) {
      store.setComposerHint("附件已过期或下载地址不可用", "error");
      return;
    }
    const mode = options.mode === "saveAs" ? "saveAs" : "download";
    const openAfterSave = Boolean(options.openAfterSave);
    const silent = Boolean(options.silent);
    store.downloadingFile.value = true;
    store.downloadProgress.value = 0;
    store.downloadFileName.value = file.name || "attachment";
    store.setFileTransfer(file.objectKey, { status: "downloading", progress: 0, path: "", error: "" });
    try {
      const blob = await chatApi.getBlobWithProgress(
        `/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`,
        ({ percent }) => {
          store.downloadProgress.value = percent;
          store.setFileTransfer(file.objectKey, { status: "downloading", progress: percent });
        },
      );
      store.downloadProgress.value = 100;
      store.setFileTransfer(file.objectKey, { status: "saving", progress: 100 });
      if (window.desktopShell?.isDesktop && typeof window.desktopShell?.saveDownloadedFile === "function") {
        const saved = await window.desktopShell.saveDownloadedFile({
          fileName: file.name || "attachment",
          bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
          conversationId: store.selectedId.value || "shared",
          cacheKey: file.objectKey,
          saveAs: mode === "saveAs",
        });
        if (saved?.canceled) {
          store.setFileTransfer(file.objectKey, { status: "", progress: 0, path: "", error: "" });
          return;
        }
        if (!silent) {
          store.pushNotification({
            title: mode === "saveAs" ? "已另存为" : "已保存到本地",
            message: saved?.exportPath || file.name || "附件",
            tone: "success",
            ttl: 2600,
          });
        }
        store.setFileTransfer(file.objectKey, {
          status: "saved",
          progress: 100,
          path: saved?.exportPath || "",
          error: "",
        });
        if (openAfterSave && saved?.exportPath && typeof window.desktopShell?.openFile === "function") {
          await window.desktopShell.openFile(saved.exportPath).catch(() => {});
        }
      } else {
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = file.name || "attachment";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
        if (!silent) {
          store.pushNotification({ title: "开始下载", message: file.name || "附件", tone: "success", ttl: 2200 });
        }
        store.setFileTransfer(file.objectKey, { status: "saved", progress: 100, path: file.name || "附件", error: "" });
      }
      appendAppLog({ level: "info", category: "file", message: `开始下载 ${file.name || "附件"}` });
    } catch (error) {
      store.setFileTransfer(file.objectKey, {
        status: "failed",
        progress: 0,
        error: error?.message || "下载失败",
      });
      throw error;
    } finally {
      window.setTimeout(() => {
        store.downloadingFile.value = false;
        store.downloadProgress.value = 0;
        store.downloadFileName.value = "";
      }, 600);
    }
  }

  async function autoReceiveImages(files = []) {
    const targets = files.filter((file) => (
      file?.isImage
      && file?.objectKey
      && !file?.expired
      && !autoReceiveQueue.has(String(file.objectKey))
      && !["saved", "saving", "downloading"].includes(String(file?.transfer?.status || ""))
    ));
    for (const file of targets) {
      const objectKey = String(file.objectKey);
      autoReceiveQueue.add(objectKey);
      try {
        await downloadFile(file, { silent: true });
      } catch {
        // Keep quiet for background auto-receive failures; manual actions still surface errors.
      } finally {
        autoReceiveQueue.delete(objectKey);
      }
    }
  }

  async function openFileLocation(file) {
    const targetPath = String(file?.transfer?.path || "").trim();
    if (!targetPath) {
      store.setComposerHint("该文件还没有本地保存记录", "error");
      return;
    }
    if (typeof window.desktopShell?.openStoragePath !== "function") {
      store.setComposerHint("当前环境不支持打开文件位置", "error");
      return;
    }
    await window.desktopShell.openStoragePath(targetPath);
  }

  async function openFile(file) {
    const targetPath = String(file?.transfer?.path || "").trim();
    if (targetPath && typeof window.desktopShell?.openFile === "function") {
      const opened = await window.desktopShell.openFile(targetPath);
      if (!opened) throw new Error("文件打开失败");
      return;
    }
    await downloadFile(file, { openAfterSave: true });
  }

  async function saveFileAs(file) {
    await downloadFile(file, { mode: "saveAs" });
  }

  async function copyImageToClipboard(file) {
    if (!file?.objectKey || !isImageFileLike(file)) {
      store.setComposerHint("当前附件不是可复制的图片", "error");
      return;
    }
    const blob = await chatApi.getBlob(`/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`);
    if (typeof window.desktopShell?.writeImageToClipboard === "function") {
      await window.desktopShell.writeImageToClipboard({
        fileName: file.name || "image.png",
        mimeType: file.mimeType || blob.type || "image/png",
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      });
      store.setComposerHint("图片已复制到剪贴板", "success");
      return;
    }
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type || "image/png"]: blob })]);
      store.setComposerHint("图片已复制到剪贴板", "success");
      return;
    }
    throw new Error("当前环境不支持复制图片");
  }

  async function recallMessage(messageId) {
    const message = findMessage(store, messageId);
    if (!message || message.operationState) return;
    patchMessageLocally(store, messageId, {
      content: "",
      files: [],
      mentions: [],
      deletedAt: new Date().toISOString(),
      operationState: "recalling",
      sendError: "",
    });
    const payload = await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/${encodeURIComponent(messageId)}/recall`, {});
    if (payload.data) {
      const normalized = normalizeMessage(payload.data);
      replaceMessageLocally(store, messageId, normalized);
      syncConversationPreview(store, store.selectedId.value, normalized);
    }
  }

  async function deleteMessage(messageId) {
    const message = findMessage(store, messageId);
    if (!message || message.operationState) return;
    patchMessageLocally(store, messageId, { operationState: "recalling", sendError: "" });
    try {
      const payload = await chatApi.delete(
        `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/${encodeURIComponent(messageId)}`,
      );
      if (payload.data) {
        const normalized = normalizeMessage(payload.data);
        replaceMessageLocally(store, messageId, normalized);
        syncConversationPreview(store, store.selectedId.value, normalized);
        appendAppLog({ level: "info", category: "message", message: "消息已删除" });
      }
    } catch (error) {
      patchMessageLocally(store, messageId, { operationState: "", sendError: "" });
      throw error;
    }
  }

  async function submitForwardMessage() {
    const message = findMessage(store, store.forwardingMessageId.value);
    const targetConversationId = String(store.forwardConversationId.value || "");
    if (!message) {
      store.forwardHint.value = "转发消息不存在";
      return;
    }
    if (!targetConversationId) {
      store.forwardHint.value = "请选择一个目标会话";
      return;
    }
    if (!message.canForward) {
      store.forwardHint.value = "当前消息暂不支持转发";
      return;
    }

    store.forwardSubmitting.value = true;
    store.forwardHint.value = "";
    try {
      if (Array.isArray(message.files) && message.files.length) {
        await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(targetConversationId)}/messages/forward`, {
          sourceConversationId: String(message.conversationId || store.selectedId.value || ""),
          sourceMessageId: String(message.id || ""),
        });
      } else {
        await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(targetConversationId)}/messages`, {
          content: message.content || "",
          mentions: [],
          replyToId: null,
        });
      }
      store.closeForwardDialog();
      store.pushNotification({ title: "转发成功", message: "消息已发送到目标会话", tone: "success" });
      appendAppLog({ level: "info", category: "message", message: `消息已转发到会话 ${targetConversationId}` });
      await dataActions.loadConversations();
    } catch (error) {
      store.forwardHint.value = error?.message || "转发失败";
      appendAppLog({ level: "error", category: "message", message: "消息转发失败", meta: error?.message || "" });
    } finally {
      store.forwardSubmitting.value = false;
    }
  }

  async function submitConfirmDialog() {
    if (typeof store.pendingConfirmAction.value !== "function") return;
    store.confirmDialogSubmitting.value = true;
    try {
      await store.pendingConfirmAction.value();
      store.closeConfirmDialog();
    } finally {
      store.confirmDialogSubmitting.value = false;
    }
  }

  async function toggleConversationPin() {
    const selected = store.selectedConversation.value;
    if (!selected?.id) return;
    if (selected.pinnedAt) {
      await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(selected.id)}/pin`);
      patchConversationLocally(store, selected.id, { pinnedAt: null });
      store.setComposerHint("已取消置顶", "success");
      return;
    }
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(selected.id)}/pin`, {});
    patchConversationLocally(store, selected.id, { pinnedAt: new Date().toISOString() });
    store.setComposerHint("已置顶会话", "success");
  }

  async function toggleConversationPinById(conversationId) {
    const target = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    if (!target) return;
    if (target.pinnedAt) {
      await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(conversationId)}/pin`);
      patchConversationLocally(store, conversationId, { pinnedAt: null });
      return;
    }
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/pin`, {});
    patchConversationLocally(store, conversationId, { pinnedAt: new Date().toISOString() });
  }

  async function markConversationReadById(conversationId) {
    const target = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    const lastMessageId = target?.lastMessage?.id ? String(target.lastMessage.id) : "";
    if (!target?.id || !lastMessageId) return;
    if (!target.unreadCount && !target.unreadMentionCount) return;
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(target.id)}/read`, {
      messageId: lastMessageId,
    });
    patchConversationLocally(store, target.id, {
      unreadCount: 0,
      unreadMentionCount: 0,
      lastReadAt: new Date().toISOString(),
    });
  }

  function handleMessageAction({ id, action }) {
    const message = findMessage(store, id);
    if (!message || (message.operationState && action !== "retry")) return;
    if (action === "reply") {
      store.replyTo.value = message;
      return;
    }
    if (action === "favorite") {
      store.toggleFavoriteMessage(message);
      appendAppLog({
        level: "info",
        category: "message",
        message: message.isFavorite ? "已取消收藏消息" : "已收藏消息",
      });
      return;
    }
    if (action === "forward") {
      store.openForwardDialog(message.id);
      return;
    }
    if (action === "recall") {
      recallMessage(message.id).catch((error) => {
        store.setComposerHint(error?.message || "撤回失败", "error");
        dataActions.refreshSelectedConversation().catch(() => {});
      });
      return;
    }
    if (action === "delete") {
      deleteMessage(message.id).catch((error) => {
        store.setComposerHint(error?.message || "删除失败", "error");
        dataActions.refreshSelectedConversation().catch(() => {});
      });
      return;
    }
    if (action === "retry") {
      retryMessage(message.id).catch((error) => {
        store.setComposerHint(error?.message || "重试失败", "error");
      });
    }
  }

  async function saveProfile() {
    try {
      const payload = await chatApi.patchJson("/api/v1/users/me/profile", {
        realName: store.profileName.value.trim(),
        bio: store.profileBio.value.trim(),
      });
      syncCurrentUserProfileLocally({
        realName: payload.data?.realName || store.profileName.value.trim(),
        originalRealName: payload.data?.originalRealName || payload.data?.realName || store.profileName.value.trim(),
        bio: payload.data?.bio ?? store.profileBio.value.trim(),
        profileVersion: Number(payload.data?.profileVersion || store.me.value?.profile?.profileVersion || 0),
        avatarVersion: Number(payload.data?.avatarVersion || store.me.value?.profile?.avatarVersion || 0),
      });
      store.profileHint.value = "资料已保存";
      store.profileHintTone.value = "success";
      document.title = `Linksee Chat · ${store.profileName.value}`;
      Promise.allSettled([
        dataActions.loadContacts(),
        dataActions.loadConversations(),
        dataActions.loadParticipants(),
      ]).then(() => {
        persistSidebarCaches();
      });
    } catch (error) {
      store.profileHint.value = error?.message || "保存失败";
      store.profileHintTone.value = "error";
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    const payload = await chatApi.postBinary("/api/v1/users/me/avatar", file, {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name || "avatar"),
    });
    const refreshedUrl = appendCacheBust(payload.data?.avatarUrl || "", Date.now());
    syncCurrentUserProfileLocally({
      avatarUrl: refreshedUrl,
      avatarVersion: Number(payload.data?.avatarVersion || store.me.value?.profile?.avatarVersion || 0),
    });
    store.profileHint.value = "头像已上传";
    store.profileHintTone.value = "success";
    Promise.allSettled([
      dataActions.loadProfile({ userId: store.me.value?.id || localStorage.getItem("chat_user_id") || "" }),
      dataActions.loadContacts(),
      dataActions.loadConversations(),
      dataActions.loadParticipants(),
    ]).then(() => {
      syncCurrentUserProfileLocally({
        avatarUrl: refreshedUrl,
        avatarVersion: Number(payload.data?.avatarVersion || store.me.value?.profile?.avatarVersion || 0),
      });
    });
  }

  return {
    loadProfile: dataActions.loadProfile,
    loadContacts: dataActions.loadContacts,
    loadConversations: dataActions.loadConversations,
    loadParticipants: dataActions.loadParticipants,
    loadMessages: dataActions.loadMessages,
    loadOlderMessages: dataActions.loadOlderMessages,
    refreshSelectedConversation: dataActions.refreshSelectedConversation,
    refreshAll: dataActions.refreshAll,
    markConversationReadIfNeeded: dataActions.markConversationReadIfNeeded,
    saveConversationDraft: dataActions.saveConversationDraft,
    loadConversationDraft: dataActions.loadConversationDraft,
    selectConversation,
    createDirectConversation,
    createGroupConversation,
    openOrCreateDirectConversation,
    submitCreateConversation,
    searchMessages: dataActions.searchMessages,
    sendAnnouncement,
    submitAnnouncement,
    submitComposer,
    uploadFiles,
    queueFiles,
    downloadFile,
    saveFileAs,
    openFile,
    openFileLocation,
    copyImageToClipboard,
    autoReceiveImages,
    handleMessageAction,
    submitForwardMessage,
    submitConfirmDialog,
    toggleConversationPin,
    toggleConversationPinById,
    markConversationReadById,
    saveProfile,
    uploadAvatar,
    applyUserProfileUpdate,
    markProfileDirty,
    refreshProfilesIfDirty,
  };
}

import assert from "node:assert/strict";

process.env.MINIO_PUBLIC_ORIGIN = "https://files.example.com";

const { toPublicMinioUrl } = await import("../../infra/storage/minio.mjs");
const { mergeUserProfile, mergeUsersById } = await import("../../apps/web/src/chat/composables/chat-profile-merge.js");
const { mergeMessagesById } = await import("../../apps/web/src/chat/composables/chat-profile-merge-conversations.js");
const { resolveImageViewerOwnerMessageId } = await import("../../apps/web/src/chat/composables/chat-image-viewer-derived.js");
const { isMessageActionAvailable } = await import("../../apps/web/src/chat/composables/chat-message-action-rules.js");
const { pickVisibleConversationPreview } = await import("../../apps/web/src/chat/composables/message-visibility-cache.js");
const { resolveIncomingNotificationCopy } = await import("../../apps/web/src/chat/composables/chat-realtime-notifications.js");
const { buildDerivedConversationPreview, buildDerivedMessagePreview, buildFavoriteMessagePreview, buildReplyPreviewText } = await import("../../apps/web/src/chat/store/chat-store-derived-utils.js");
const { canDeleteMessageForCurrentUser } = await import("../../apps/web/src/chat/store/chat-store-message-derived.js");

const source = "http://minio:9000/chat-files/path/file.txt?X-Amz-Signature=abc";
const result = toPublicMinioUrl(source);
const url = new URL(result);

assert.equal(url.origin, "https://files.example.com");
assert.equal(url.pathname, "/chat-files/path/file.txt");
assert.equal(url.searchParams.get("X-Amz-Signature"), "abc");

console.log("[unit] minio public URL rewrite ok");

const mergedSelf = mergeUserProfile(
  {
    id: "alice",
    profile: {
      realName: "Alice Zhang",
      originalRealName: "Alice Zhang",
      bio: "cached bio",
      avatarUrl: "/cached-avatar.png",
      profileVersion: 2,
      avatarVersion: 2,
    },
  },
  {
    id: "alice",
    profile: {
      realName: "alice",
      bio: "",
      avatarUrl: "",
      profileVersion: 2,
      avatarVersion: 2,
    },
  },
  "alice",
);
assert.equal(mergedSelf.profile.realName, "Alice Zhang");
assert.equal(mergedSelf.profile.bio, "cached bio");
assert.equal(mergedSelf.profile.avatarUrl, "/cached-avatar.png");

const mergedContacts = mergeUsersById(
  [{ id: "bob", profile: { realName: "Bob", bio: "cached", profileVersion: 1, avatarVersion: 1 } }],
  [{ id: "bob", profile: { realName: "bob", bio: "", profileVersion: 1, avatarVersion: 1 } }],
);
assert.equal(mergedContacts[0].profile.realName, "Bob");

const mergedMessages = mergeMessagesById(
  [{ id: "1", sender: { id: "carol", profile: { realName: "Carol", profileVersion: 1, avatarVersion: 1 } } }],
  [{ id: "1", sender: { id: "carol", profile: { realName: "carol", profileVersion: 1, avatarVersion: 1 } } }],
);
assert.equal(mergedMessages[0].sender.profile.realName, "Carol");

console.log("[unit] chat profile merge keeps richer cached profile data");

const ownerFromExplicitMessage = resolveImageViewerOwnerMessageId(
  [{ id: "msg-a", files: [{ objectKey: "img-1" }] }],
  "msg-explicit",
  { objectKey: "img-1" },
  null,
);
assert.equal(ownerFromExplicitMessage, "msg-explicit");

const ownerFromObjectKeyLookup = resolveImageViewerOwnerMessageId(
  [{ id: "msg-b", files: [{ objectKey: "img-2" }] }],
  "",
  { objectKey: "img-2" },
  null,
);
assert.equal(ownerFromObjectKeyLookup, "msg-b");

console.log("[unit] image viewer keeps source message for forwarding");

assert.equal(canDeleteMessageForCurrentUser({ senderId: "bob", deletedAt: null, operationState: "" }, "alice"), true);
assert.equal(canDeleteMessageForCurrentUser({ senderId: "bob", deletedAt: null, operationState: "sending" }, "alice"), false);
assert.equal(canDeleteMessageForCurrentUser({ senderId: "alice", deletedAt: null, operationState: "failed" }, "alice"), true);
assert.equal(canDeleteMessageForCurrentUser({ senderId: "bob", deletedAt: "2026-01-01T00:00:00.000Z", operationState: "" }, "alice"), false);

console.log("[unit] local delete is available for normal visible messages");

assert.equal(isMessageActionAvailable({ deletedAt: null, operationState: "failed", canCopy: true }, "copy"), true);
assert.equal(isMessageActionAvailable({ deletedAt: null, operationState: "failed" }, "reply"), false);
assert.equal(isMessageActionAvailable({ deletedAt: null, operationState: "failed", canDelete: true }, "delete"), true);
assert.equal(isMessageActionAvailable({ deletedAt: null, operationState: "", canForward: true }, "forward"), true);

console.log("[unit] failed message actions stay consistent with menu rules");

assert.equal(
  buildReplyPreviewText({
    sender: { profile: { realName: "张三" } },
    content: "",
    files: [{ name: "原图.png" }, { name: "设计稿.sketch" }],
  }),
  "回复 张三：原图.png、设计稿.sketch",
);

console.log("[unit] reply preview keeps attachment names");

assert.equal(
  buildDerivedConversationPreview({
    kind: "group",
    lastMessage: {
      senderId: "bob",
      sender: { profile: { realName: "李明" } },
      content: "最新版已经上传",
      type: "text",
    },
  }, "alice"),
  "李明：最新版已经上传",
);

assert.equal(
  buildDerivedConversationPreview({
    kind: "group",
    lastMessage: {
      senderId: "alice",
      content: "我来跟进",
      type: "text",
    },
  }, "alice"),
  "你：我来跟进",
);

console.log("[unit] group conversation preview keeps sender context");

assert.deepEqual(
  resolveIncomingNotificationCopy({
    kind: "direct",
    participants: [
      { id: "alice", profile: { realName: "Alice" } },
      { id: "bob", profile: { realName: "Bob" } },
    ],
    lastMessage: { senderId: "bob", content: "在吗", type: "text" },
  }, "alice"),
  { title: "Bob", body: "在吗" },
);

console.log("[unit] notification copy uses derived conversation title");

assert.equal(
  buildFavoriteMessagePreview({ type: "file", content: "", preview: "" }),
  "[空消息]",
);

assert.equal(
  buildFavoriteMessagePreview({ preview: "原图.png" }),
  "原图.png",
);

console.log("[unit] favorite preview follows derived message summary");

assert.equal(
  buildDerivedMessagePreview({ type: "file", content: "", files: [{ name: "原图.png", mimeType: "image/png" }] }),
  "原图.png",
);

assert.equal(
  buildDerivedMessagePreview({ type: "text", content: "", files: [{ name: "", mimeType: "image/png" }] }),
  "[图片]",
);

console.log("[unit] message preview falls back to attachment summary");

const localPreviewFallback = pickVisibleConversationPreview(
  [
    { id: "1", content: "旧消息", type: "text" },
    { id: "2", content: "", type: "file", files: [{ name: "合同.pdf", mimeType: "application/pdf" }] },
  ],
  "1",
);
assert.equal(localPreviewFallback.id, "2");
assert.equal(localPreviewFallback.content, "合同.pdf");
assert.equal(localPreviewFallback.type, "file");

console.log("[unit] local preview fallback uses derived message summary");

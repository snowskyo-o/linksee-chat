import assert from "node:assert/strict";

process.env.MINIO_PUBLIC_ORIGIN = "https://files.example.com";

const { toPublicMinioUrl } = await import("../../infra/storage/minio.mjs");
const { mergeUserProfile, mergeUsersById } = await import("../../apps/web/src/chat/composables/chat-profile-merge.js");
const { mergeMessagesById } = await import("../../apps/web/src/chat/composables/chat-profile-merge-conversations.js");
const { resolveImageViewerOwnerMessageId } = await import("../../apps/web/src/chat/composables/chat-image-viewer-derived.js");

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

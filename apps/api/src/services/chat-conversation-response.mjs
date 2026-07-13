import { buildConversationTitle, buildMessageType } from "./chat-store.mjs";
import { publicAvatarUrl, sanitizeUser } from "./chat-user-presenter.mjs";
import { loadConversationMeta, loadUnreadState } from "./chat-conversation-response-state.mjs";
import { decorateUsersWithFriendAliases } from "./friend-store.mjs";

function buildLastMessageResponse(lastMessage) {
  if (!lastMessage) return null;
  return {
    id: lastMessage.id.toString(),
    conversationId: lastMessage.conversationId.toString(),
    senderId: lastMessage.senderId,
    sender: {
      id: lastMessage.sender.id,
      role: lastMessage.sender.role,
      profile: {
        realName: lastMessage.sender.profile?.realName || lastMessage.sender.id,
        bio: lastMessage.sender.profile?.bio || "",
        avatarUrl: publicAvatarUrl(lastMessage.sender),
      },
    },
    content: lastMessage.content,
    type: buildMessageType(lastMessage.files, lastMessage.content),
    files: Array.isArray(lastMessage.files) ? lastMessage.files : null,
    deletedAt: lastMessage.deletedAt?.toISOString?.() || null,
  };
}

export async function buildConversationResponse(userId, conversation) {
  const [{ reads, pin, lastMessage }, participants] = await Promise.all([
    loadConversationMeta(userId, conversation),
    decorateUsersWithFriendAliases(
      userId,
      conversation.members.map((member) => sanitizeUser(member.user)),
    ),
  ]);
  const unreadState = await loadUnreadState(userId, conversation.id, reads?.lastMessageId || null);
  return buildConversationPayload(
    userId,
    conversation,
    participants,
    pin,
    reads,
    lastMessage,
    unreadState,
  );
}

function buildConversationPayload(userId, conversation, participants, pin, reads, lastMessage, unreadState) {
  const directPeer = conversation.kind === "direct"
    ? participants.find((item) => item.id !== userId)
    : null;

  return {
    id: conversation.id.toString(),
    createdBy: conversation.createdBy || "",
    title: conversation.title || directPeer?.profile?.realName || buildConversationTitle(conversation, userId),
    roomKey: conversation.roomKey,
    kind: conversation.kind,
    updatedAt: conversation.updatedAt.toISOString(),
    pinnedAt: pin?.pinnedAt?.toISOString() || null,
    scopeType: conversation.kind,
    scopeId: conversation.scopeId,
    unreadCount: unreadState.unreadCount,
    unreadMentionCount: unreadState.unreadMentionCount,
    participants,
    participantIds: conversation.members.map((member) => member.userId),
    lastReadAt: reads?.lastReadAt?.toISOString() || null,
    lastMessage: buildLastMessageResponse(lastMessage),
  };
}

export function buildFriendshipWhere(userId) {
  return {
    OR: [
      { userLowId: userId },
      { userHighId: userId },
    ],
  };
}

export function buildDirectConversationWhere(userId) {
  return {
    kind: "direct",
    members: { some: { userId } },
  };
}

export function collectContactIds(friendships, directConversations, userId) {
  const contactIds = new Set(friendships.map((row) => (row.userLowId === userId ? row.userHighId : row.userLowId)));
  directConversations.forEach((conversation) => {
    conversation.members.forEach((member) => {
      if (member.userId !== userId) contactIds.add(member.userId);
    });
  });
  return contactIds;
}

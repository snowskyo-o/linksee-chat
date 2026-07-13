export function orderedFriendPair(userIdA, userIdB) {
  return [String(userIdA || ""), String(userIdB || "")].sort();
}

export function buildFriendRequestWhere(userId) {
  return {
    OR: [
      { senderId: userId },
      { receiverId: userId },
    ],
  };
}

export function buildFriendshipWhere(userId) {
  return {
    OR: [
      { userLowId: userId },
      { userHighId: userId },
    ],
  };
}

export function buildFriendRequestPairWhere(currentUserId, friendUserId) {
  return {
    OR: [
      { senderId: currentUserId, receiverId: friendUserId },
      { senderId: friendUserId, receiverId: currentUserId },
    ],
  };
}

import { sanitizeUser } from "./chat-user-presenter.mjs";
import { decorateSanitizedUser, extractFriendAlias } from "./friend-aliases.mjs";

function mapFriendRequest(row, currentUserId) {
  if (!row) return null;
  const isIncoming = row.receiverId === currentUserId;
  return {
    id: row.id.toString(),
    senderId: row.senderId,
    receiverId: row.receiverId,
    status: row.status,
    message: row.message || "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() || null,
    direction: isIncoming ? "incoming" : "outgoing",
    sender: sanitizeUser(row.sender),
    receiver: sanitizeUser(row.receiver),
  };
}

function mapDiscoveryRequest(request) {
  return request
    ? {
        id: request.id.toString(),
        status: request.status,
        senderId: request.senderId,
        receiverId: request.receiverId,
        message: request.message || "",
        updatedAt: request.updatedAt.toISOString(),
      }
    : null;
}

function resolveFriendRelation(request, friendship, userId) {
  if (friendship || request?.status === "accepted") return "friend";
  if (request?.status === "pending") {
    return request.senderId === userId ? "outgoing_pending" : "incoming_pending";
  }
  if (request?.status === "rejected") return "rejected";
  if (request?.status === "canceled") return "canceled";
  return "none";
}

export function mapFriendRequests(rows, userId) {
  return rows.map((row) => mapFriendRequest(row, userId)).filter(Boolean);
}

export function decorateMappedRequests(mappedRows, userId, aliasMap) {
  return mappedRows.map((row) => ({
    ...row,
    sender: decorateSanitizedUser(row.sender, aliasMap.get(row.senderId)),
    receiver: decorateSanitizedUser(row.receiver, aliasMap.get(row.receiverId)),
  }));
}

export function buildDiscoveryRows(users, requests, friendships, userId, search = "") {
  const requestMap = new Map();
  requests.forEach((row) => {
    const peerId = row.senderId === userId ? row.receiverId : row.senderId;
    if (!requestMap.has(peerId)) requestMap.set(peerId, row);
  });

  const friendshipMap = new Map(friendships.map((row) => ([
    row.userLowId === userId ? row.userHighId : row.userLowId,
    row,
  ])));

  const normalizedSearch = String(search || "").trim().toLowerCase();
  return users
    .filter((user) => {
      const friendship = friendshipMap.get(user.id) || null;
      const friendAlias = extractFriendAlias(friendship, userId);
      if (!normalizedSearch) return true;
      return [user.id, user.profile?.realName, user.profile?.bio, friendAlias]
        .some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
    })
    .map((user) => {
      const request = requestMap.get(user.id) || null;
      const friendship = friendshipMap.get(user.id) || null;
      return {
        user: decorateSanitizedUser(sanitizeUser(user), extractFriendAlias(friendship, userId)),
        relation: resolveFriendRelation(request, friendship, userId),
        request: mapDiscoveryRequest(request),
      };
    });
}

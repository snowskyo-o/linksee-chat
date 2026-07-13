import { Router } from "express";
import { registerChatFriendContactRoutes } from "./chat-friend-contact-routes.mjs";
import { registerChatFriendQueryRoutes } from "./chat-friend-query-routes.mjs";
import { registerChatFriendRequestRoutes } from "./chat-friend-request-routes.mjs";

export function createChatFriendRouter() {
  const router = Router();
  registerChatFriendQueryRoutes(router);
  registerChatFriendRequestRoutes(router);
  registerChatFriendContactRoutes(router);
  return router;
}

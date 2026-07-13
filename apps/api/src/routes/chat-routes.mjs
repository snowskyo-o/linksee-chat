import { Router } from "express";
import { createChatFileRouter } from "./chat-file-routes.mjs";
import { createChatFriendRouter } from "./chat-friend-routes.mjs";
import { registerChatConversationRoutes } from "./chat-conversation-routes.mjs";
import { registerChatGroupRoutes } from "./chat-group-routes.mjs";
import { createChatMessageRouter } from "./chat-message-routes.mjs";

export function createChatRouter(emitConversationEvent) {
  const router = Router();
  router.use(createChatFriendRouter());
  router.use(createChatFileRouter());
  router.use(createChatMessageRouter(emitConversationEvent));
  registerChatConversationRoutes(router);
  registerChatGroupRoutes(router, emitConversationEvent);
  return router;
}

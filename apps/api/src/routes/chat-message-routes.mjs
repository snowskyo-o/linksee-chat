import { Router } from "express";
import { registerChatMessageCreateRoutes } from "./chat-message-create-routes.mjs";
import { registerChatMessageQueryRoutes } from "./chat-message-query-routes.mjs";
import { registerChatMessageReadRoutes } from "./chat-message-read-routes.mjs";
import { registerChatMessageStateRoutes } from "./chat-message-state-routes.mjs";

export function createChatMessageRouter(emitConversationEvent) {
  const router = Router();
  registerChatMessageQueryRoutes(router);
  registerChatMessageCreateRoutes(router, emitConversationEvent);
  registerChatMessageStateRoutes(router, emitConversationEvent);
  registerChatMessageReadRoutes(router, emitConversationEvent);
  return router;
}

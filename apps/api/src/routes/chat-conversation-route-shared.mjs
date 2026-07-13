import { prisma } from "../../../../infra/db/prisma.mjs";
import { resolveConversationById, sanitizeUser } from "../services/chat-store.mjs";
import { buildConversationResponse, requireConversation } from "../services/chat-domain.mjs";

export { prisma, resolveConversationById, sanitizeUser, buildConversationResponse, requireConversation };

export function validationFailed(res, message) {
  return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message });
}

export function forbidden(res, message) {
  return res.status(403).json({ ok: false, code: "FORBIDDEN", message });
}

export function notFound(res, message) {
  return res.status(404).json({ ok: false, code: "NOT_FOUND", message });
}

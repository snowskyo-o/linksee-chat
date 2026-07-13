import { removeFriendship, updateFriendAlias } from "../services/friend-store.mjs";
import { badRequest } from "./chat-friend-route-shared.mjs";

export function registerChatFriendContactRoutes(router) {
  router.patch("/friends/:friendUserId/alias", async (req, res) => {
    const friendUserId = typeof req.params.friendUserId === "string" ? req.params.friendUserId.trim() : "";
    const alias = typeof req.body?.alias === "string" ? req.body.alias.trim() : "";
    if (!friendUserId || friendUserId === req.userId) return badRequest(res, "friendUserId 无效");
    if (alias.length > 40) return badRequest(res, "备注不能超过 40 个字符");

    const updated = await updateFriendAlias(req.userId, friendUserId, alias);
    if (!updated) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "好友关系不存在" });
    }
    return res.json({ ok: true, data: { friendUserId, alias } });
  });

  router.delete("/friends/:friendUserId", async (req, res) => {
    const friendUserId = typeof req.params.friendUserId === "string" ? req.params.friendUserId.trim() : "";
    if (!friendUserId || friendUserId === req.userId) return badRequest(res, "friendUserId 无效");

    const removed = await removeFriendship(req.userId, friendUserId);
    if (!removed) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "好友关系不存在" });
    }
    return res.json({ ok: true, data: { friendUserId } });
  });
}

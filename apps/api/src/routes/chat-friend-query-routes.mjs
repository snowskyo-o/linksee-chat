import { findContacts } from "../services/chat-store.mjs";
import { listFriendDiscovery, listFriendRequestsForUser } from "../services/friend-store.mjs";

export function registerChatFriendQueryRoutes(router) {
  router.get("/contacts", async (req, res) => {
    const contacts = await findContacts(req.userId);
    return res.json({ ok: true, data: contacts });
  });

  router.get("/friends/discovery", async (req, res) => {
    const keyword = typeof req.query.q === "string" ? req.query.q : "";
    const data = await listFriendDiscovery(req.userId, keyword);
    return res.json({ ok: true, data });
  });

  router.get("/friends/requests", async (req, res) => {
    const data = await listFriendRequestsForUser(req.userId);
    return res.json({ ok: true, data });
  });
}

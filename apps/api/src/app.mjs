import express from "express";
import { createChatRouter } from "./routes/chat-routes.mjs";
import { authRouter } from "./routes/auth-routes.mjs";
import { profileRouter, publicProfileRouter } from "./routes/profile-routes.mjs";
import { realtimeRouter } from "./routes/realtime-routes.mjs";
import { findUserIdByAccessToken } from "./services/session-store.mjs";
import { webStaticDir } from "../../../infra/paths/index.mjs";

async function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, code: "UNAUTHENTICATED", message: "Missing token" });
  }

  const token = header.slice(7);
  const userId = await findUserIdByAccessToken(token);
  if (!userId) {
    return res.status(401).json({ ok: false, code: "UNAUTHENTICATED", message: "Invalid or expired token" });
  }

  req.userId = userId;
  req.accessToken = token;
  next();
}

export function createApp(emitConversationEvent) {
  const app = express();

  app.use(express.json());
  app.use("/chat", express.static(webStaticDir));

  app.get("/", (_req, res) => {
    res.redirect("/chat/login.html");
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "linksee-chat", now: new Date().toISOString() });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1", publicProfileRouter);
  app.use("/api/v1", requireAuth, profileRouter);
  app.use("/api/v1", requireAuth, realtimeRouter);
  app.use("/api/v1", requireAuth, createChatRouter(emitConversationEvent));

  return app;
}

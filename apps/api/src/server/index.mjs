import http from "node:http";
import { env } from "../../../../infra/config/env.mjs";
import { ensureStorageReady } from "../../../../infra/storage/minio.mjs";
import { createApp } from "../app.mjs";
import { setupSocketGateway } from "../realtime/socket-gateway.mjs";
import { cleanupExpiredChatFiles } from "../services/chat-file-service.mjs";

const server = http.createServer();
const gateway = setupSocketGateway(server);
const app = createApp(gateway.emitConversationEvent);

server.removeAllListeners("request");
server.on("request", app);

await ensureStorageReady();

setInterval(() => {
  cleanupExpiredChatFiles().catch(() => {});
}, 60 * 1000).unref();

server.listen(env.port, () => {
  console.log(`[linksee-chat] listening on http://localhost:${env.port}`);
});

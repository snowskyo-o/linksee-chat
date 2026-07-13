import http from "node:http";
import { env } from "../../../../infra/config/env.mjs";
import { ensureStorageReady } from "../../../../infra/storage/minio.mjs";
import { createApp } from "../app.mjs";
import { setupSocketGateway } from "../realtime/socket-gateway.mjs";
import { cleanupExpiredChatFiles } from "../services/chat-file-service.mjs";
import { logger } from "../../../../infra/logging/logger.mjs";

const server = http.createServer();
const gateway = setupSocketGateway(server);
const app = createApp(gateway);

server.removeAllListeners("request");
server.on("request", app);

await ensureStorageReady();

setInterval(() => {
  cleanupExpiredChatFiles().catch((error) => {
    logger.warn("chat_files.cleanup_failed", { error: error?.message || String(error) });
  });
}, 60 * 1000).unref();

server.listen(env.port, () => {
  logger.info("server.listening", { port: env.port });
});

import express, { Router } from "express";
import { CHAT_FILE_MAX_BYTES } from "../services/chat-file-service.mjs";
import {
  cleanupChatFiles,
  downloadChatFile,
  presignDownloadChatFile,
  presignUploadChatFile,
  uploadDirectChatFile,
} from "./chat-file-route-handlers.mjs";

export function createChatFileRouter() {
  const router = Router();
  router.get("/chat/files/download", downloadChatFile);
  router.post("/chat/files/presign-upload", presignUploadChatFile);
  router.post("/chat/files/upload-direct", express.raw({ type: () => true, limit: CHAT_FILE_MAX_BYTES + 1024 * 1024 }), uploadDirectChatFile);
  router.get("/chat/files/presign-download", presignDownloadChatFile);
  router.post("/maintenance/chat-files/cleanup", cleanupChatFiles);

  return router;
}

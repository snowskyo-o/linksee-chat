import express, { Router } from "express";
import {
  checkVisibleProfiles,
  createPatchProfileHandler,
  createUploadAvatarHandler,
  getCurrentUserProfile,
  getPublicProfile,
  patchPassword,
  streamUserAvatar,
} from "./profile-route-handlers.mjs";

export const publicProfileRouter = Router();
publicProfileRouter.get("/users/:userId/profile", getPublicProfile);

publicProfileRouter.get("/users/:userId/avatar", streamUserAvatar);

export function createProfileRouter(emitUserProfileEvent) {
  const router = Router();
  router.get("/users/me", getCurrentUserProfile);
  router.post("/users/profiles/check", checkVisibleProfiles);
  router.patch("/users/me/profile", createPatchProfileHandler(emitUserProfileEvent));
  router.patch("/users/me/password", patchPassword);
  router.post("/users/me/avatar", express.raw({ type: () => true, limit: "5mb" }), createUploadAvatarHandler(emitUserProfileEvent));

  return router;
}

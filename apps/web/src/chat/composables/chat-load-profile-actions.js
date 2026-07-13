import { readChatCache, writeChatCache } from "./local-chat-cache.js";
import { normalizeUser } from "./message-operations.js";
import { mergeUserProfile } from "./chat-profile-merge.js";

function applyCurrentProfile(store, auth, user) {
  store.me.value = normalizeUser(user || {});
  store.profileName.value = store.me.value.profile?.realName || auth.userId;
  store.profileBio.value = store.me.value.profile?.bio || "";
  document.title = `Linksee Chat · ${store.profileName.value}`;
}

export function createChatLoadProfileActions({ store, chatApi, cacheUserId }) {
  async function loadProfile(auth) {
    const cached = await readChatCache(cacheUserId(), "profile");
    if (cached?.data) applyCurrentProfile(store, auth, cached.data);
    const payload = await chatApi.getJson("/api/v1/users/me");
    const mergedProfile = mergeUserProfile(cached?.data || null, payload.data || null, auth.userId);
    applyCurrentProfile(store, auth, mergedProfile);
    writeChatCache(cacheUserId(), "profile", { data: mergedProfile, cachedAt: new Date().toISOString() }).catch(() => {});
  }

  return { loadProfile };
}

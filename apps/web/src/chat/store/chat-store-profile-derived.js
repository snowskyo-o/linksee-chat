import { computed } from "vue";
import { resolveMediaUrl } from "../../shared/media.js";
import { getInitials } from "../../shared/utils.js";

export function createChatStoreProfileDerived(auth, state) {
  const meName = computed(() => state.me.value?.profile?.realName || auth.userId || "未登录");
  const meMeta = computed(() => state.me.value?.profile?.bio || "保持联络，保持专注");

  return {
    meName,
    meMeta,
    meAvatar: computed(() => getInitials(meName.value, auth.userId)),
    meAvatarUrl: computed(() => resolveMediaUrl(state.me.value?.profile?.avatarUrl || "")),
  };
}

import { computed, ref } from "vue";
import { chatApi } from "../shared/api-client.js";
import { resolveMediaUrl } from "../shared/media.js";
import { getInitials } from "../shared/utils.js";

export function useLoginPreview(userId) {
  const previewLoading = ref(false);
  const previewName = ref("欢迎回来");
  const previewBio = ref("输入账号以查看头像和昵称");
  const previewAvatarUrl = ref("");

  const previewInitials = computed(() => getInitials(previewName.value, userId.value || "LC"));

  async function loadPreview(nextUserId) {
    const account = String(nextUserId || "").trim();
    previewAvatarUrl.value = "";
    if (!account) {
      previewName.value = "欢迎回来";
      previewBio.value = "输入账号以查看头像和昵称";
      previewLoading.value = false;
      return;
    }

    previewLoading.value = true;
    try {
      const payload = await chatApi.request(`/api/v1/users/${encodeURIComponent(account)}/profile`);
      const profile = payload.data?.profile || {};
      previewName.value = profile.realName || account;
      previewBio.value = profile.bio || "准备开始新的会话";
      previewAvatarUrl.value = resolveMediaUrl(profile.avatarUrl || "");
    } catch (error) {
      previewName.value = account;
      previewBio.value = error?.code === "NETWORK_ERROR"
        ? `暂时无法连接 ${chatApi.getApiBaseUrl()}`
        : "未找到资料，确认账号后可直接登录";
      previewAvatarUrl.value = "";
    } finally {
      previewLoading.value = false;
    }
  }

  return {
    loadPreview,
    previewAvatarUrl,
    previewBio,
    previewInitials,
    previewLoading,
    previewName,
  };
}

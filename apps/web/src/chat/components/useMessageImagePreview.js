import { onBeforeUnmount, ref, watch } from "vue";
import { chatApi } from "../../shared/api-client.js";
import { createObjectUrlFromBlobLike } from "../../shared/blob-source.js";

export function useMessageImagePreview(fileRef) {
  const imageSrc = ref("");
  const imageLoading = ref(false);

  function revokeImageSrc() {
    if (imageSrc.value?.startsWith("blob:")) URL.revokeObjectURL(imageSrc.value);
    imageSrc.value = "";
  }

  async function loadImagePreview() {
    revokeImageSrc();
    if (!fileRef.value?.isImage || !fileRef.value?.objectKey || fileRef.value?.expired) return;
    imageLoading.value = true;
    try {
      const blob = await chatApi.getBlob(`/api/v1/chat/files/download?objectKey=${encodeURIComponent(fileRef.value.objectKey)}`);
      imageSrc.value = await createObjectUrlFromBlobLike(blob, fileRef.value?.mimeType || "image/png");
    } catch {
      imageSrc.value = "";
    } finally {
      imageLoading.value = false;
    }
  }

  watch(() => fileRef.value?.objectKey, loadImagePreview, { immediate: true });
  onBeforeUnmount(revokeImageSrc);

  return { imageLoading, imageSrc };
}

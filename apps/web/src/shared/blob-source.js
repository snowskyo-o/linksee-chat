function hasArrayBuffer(value) {
  return value && typeof value.arrayBuffer === "function";
}

export async function ensureBrowserBlob(value, fallbackType = "application/octet-stream") {
  if (value instanceof Blob) return value;

  if (hasArrayBuffer(value)) {
    const buffer = await value.arrayBuffer();
    return new Blob([buffer], {
      type: value.type || fallbackType,
    });
  }

  if (value instanceof ArrayBuffer) {
    return new Blob([value], { type: fallbackType });
  }

  if (ArrayBuffer.isView(value)) {
    return new Blob([value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)], {
      type: fallbackType,
    });
  }

  if (Array.isArray(value)) {
    return new Blob([new Uint8Array(value)], { type: fallbackType });
  }

  throw new Error("图片数据格式无效");
}

export async function createObjectUrlFromBlobLike(value, fallbackType = "application/octet-stream") {
  const blob = await ensureBrowserBlob(value, fallbackType);
  return window.URL.createObjectURL(blob);
}

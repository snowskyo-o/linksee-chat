const { clipboard, desktopCapturer, nativeImage, screen } = require("electron");

function formatCaptureStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function captureScreenshot() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const targetSize = {
    width: Math.max(1, Math.round(primaryDisplay.size.width * primaryDisplay.scaleFactor)),
    height: Math.max(1, Math.round(primaryDisplay.size.height * primaryDisplay.scaleFactor)),
  };
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: targetSize,
    fetchWindowIcons: false,
  });
  const preferredSource = sources.find((source) => String(source.display_id || "") === String(primaryDisplay.id))
    || sources[0];
  const image = preferredSource?.thumbnail;
  if (!image || image.isEmpty()) {
    throw new Error("当前无法获取桌面截图");
  }
  return {
    fileName: `截图-${formatCaptureStamp()}.png`,
    mimeType: "image/png",
    width: image.getSize().width,
    height: image.getSize().height,
    bytes: Array.from(image.toPNG()),
  };
}

function writeImageToClipboard(payload = {}) {
  const bytes = Array.isArray(payload.bytes) ? payload.bytes : [];
  if (!bytes.length) {
    throw new Error("没有可复制的图片数据");
  }
  const image = nativeImage.createFromBuffer(Buffer.from(bytes));
  if (image.isEmpty()) {
    throw new Error("图片写入剪贴板失败");
  }
  clipboard.writeImage(image);
  return { ok: true };
}

module.exports = {
  captureScreenshot,
  writeImageToClipboard,
};

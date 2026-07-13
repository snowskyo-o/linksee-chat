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

function resolveCaptureDisplay() {
  const cursorPoint = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursorPoint) || screen.getPrimaryDisplay();
}

function getCaptureTargetSize(display) {
  return {
    width: Math.max(1, Math.round(display.size.width * display.scaleFactor)),
    height: Math.max(1, Math.round(display.size.height * display.scaleFactor)),
  };
}

async function captureDisplayScreenshot(display = resolveCaptureDisplay()) {
  const targetSize = {
    ...getCaptureTargetSize(display),
  };
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: targetSize,
    fetchWindowIcons: false,
  });
  const preferredSource = sources.find((source) => String(source.display_id || "") === String(display.id))
    || sources[0];
  const image = preferredSource?.thumbnail;
  if (!image || image.isEmpty()) {
    throw new Error("当前无法获取桌面截图");
  }
  return image;
}

function buildImagePayload(image, fileName = `截图-${formatCaptureStamp()}.png`) {
  return {
    fileName,
    mimeType: "image/png",
    width: image.getSize().width,
    height: image.getSize().height,
    bytes: Array.from(image.toPNG()),
  };
}

async function captureScreenshot() {
  const image = await captureDisplayScreenshot();
  return buildImagePayload(image);
}

function cropScreenshot(image, rect = {}, scaleFactor = 1) {
  if (!image || image.isEmpty()) throw new Error("截图结果为空");
  const size = image.getSize();
  const cropRect = {
    x: Math.max(0, Math.round((Number(rect.x) || 0) * scaleFactor)),
    y: Math.max(0, Math.round((Number(rect.y) || 0) * scaleFactor)),
    width: Math.max(1, Math.round((Number(rect.width) || 0) * scaleFactor)),
    height: Math.max(1, Math.round((Number(rect.height) || 0) * scaleFactor)),
  };
  cropRect.width = Math.min(cropRect.width, Math.max(1, size.width - cropRect.x));
  cropRect.height = Math.min(cropRect.height, Math.max(1, size.height - cropRect.y));
  return image.crop(cropRect);
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
  buildImagePayload,
  captureDisplayScreenshot,
  captureScreenshot,
  cropScreenshot,
  resolveCaptureDisplay,
  writeImageToClipboard,
};

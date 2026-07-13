function createFallbackTrayIcon(nativeImage) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#4f7cff"/>
      <path d="M22 18h8v28h16v8H22V18z" fill="#ffffff"/>
    </svg>
  `.trim();
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`).resize({ width: 16, height: 16 });
}

function resolveTrayIconPath({ fs, path, process, projectRoot }) {
  const candidates = process.platform === "win32"
    ? [
        path.join(process.resourcesPath || "", "icon.ico"),
        path.join(path.dirname(process.execPath), "resources", "icon.ico"),
        path.join(projectRoot, "build", "icon.ico"),
      ]
    : [
        path.join(process.resourcesPath || "", "icon.png"),
        path.join(path.dirname(process.execPath), "resources", "icon.png"),
        path.join(projectRoot, "build", "icon.png"),
      ];
  return candidates.find((file) => file && fs.existsSync(file)) || "";
}

function createTrayIcon({ nativeImage, resolveTrayIconPath }) {
  const trayIconPath = resolveTrayIconPath();
  if (trayIconPath) {
    const icon = nativeImage.createFromPath(trayIconPath);
    if (!icon.isEmpty()) return icon.resize({ width: 16, height: 16 });
  }
  return createFallbackTrayIcon(nativeImage);
}

function buildTrayTooltip(unreadCount) {
  return unreadCount <= 0 ? "Linksee Chat" : `Linksee Chat（${unreadCount > 99 ? "99+" : unreadCount} 条未读）`;
}

module.exports = {
  buildTrayTooltip,
  createTrayIcon,
  resolveTrayIconPath,
};

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export function normalizeAppearanceMode(value) {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveAppearanceTheme(mode) {
  const normalized = normalizeAppearanceMode(mode);
  if (normalized !== "system") return normalized;
  return window.matchMedia?.(SYSTEM_DARK_QUERY)?.matches ? "dark" : "light";
}

export function applyAppearanceMode(mode) {
  const resolvedTheme = resolveAppearanceTheme(mode);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  if (document.body) document.body.dataset.theme = resolvedTheme;
  return resolvedTheme;
}

export function watchSystemAppearance(callback) {
  const media = window.matchMedia?.(SYSTEM_DARK_QUERY);
  if (!media || typeof callback !== "function") return () => {};
  const handler = () => callback(media.matches ? "dark" : "light");
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }
  media.addListener(handler);
  return () => media.removeListener(handler);
}

export function updateReminderKey(version) {
  return `linksee_update_remind_after_${String(version || "latest")}`;
}

export function shouldShowUpdatePrompt(update) {
  if (!update?.hasUpdate) return false;
  if (update.mandatory) return true;
  const remindAfter = Number(window.localStorage.getItem(updateReminderKey(update.latestVersion)) || 0);
  return Date.now() >= remindAfter;
}

export function remindUpdateLater(appInfo, updatePromptOpen) {
  const update = appInfo.value.update || {};
  const remindAfter = Date.now() + 6 * 60 * 60 * 1000;
  window.localStorage.setItem(updateReminderKey(update.latestVersion), String(remindAfter));
  updatePromptOpen.value = false;
}

let screenshotSelectionSession = null;

function createDeferred() {
  let resolve = () => {};
  let reject = () => {};
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function getScreenshotSelectionSession() {
  return screenshotSelectionSession;
}

function setScreenshotSelectionSession(value) {
  screenshotSelectionSession = value;
}

function clearScreenshotSelectionSession({ mode = "resolve", payload = { canceled: true } } = {}) {
  if (!screenshotSelectionSession) return false;
  const session = screenshotSelectionSession;
  screenshotSelectionSession = null;
  if (session.window && !session.window.isDestroyed()) session.window.destroy();
  if (mode === "reject") session.deferred.reject(payload);
  else session.deferred.resolve(payload);
  return true;
}

module.exports = {
  clearScreenshotSelectionSession,
  createDeferred,
  getScreenshotSelectionSession,
  setScreenshotSelectionSession,
};

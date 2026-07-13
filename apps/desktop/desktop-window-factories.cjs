const { createChatDesktopWindows } = require("./desktop-window-chat-factory.cjs");
const { createPrimaryDesktopWindows } = require("./desktop-window-primary-factories.cjs");

function createDesktopWindowFactories(deps) {
  return {
    ...createPrimaryDesktopWindows(deps),
    ...createChatDesktopWindows(deps),
  };
}

module.exports = {
  createDesktopWindowFactories,
};

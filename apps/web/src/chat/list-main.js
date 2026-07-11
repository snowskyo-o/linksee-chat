import { createApp } from "vue";
import "../styles/main.css";
import ConversationListWindow from "./ConversationListWindow.vue";
import { bindSessionExpiredRedirect, requireAuth } from "../shared/session.js";

bindSessionExpiredRedirect();

if (requireAuth()) {
  createApp(ConversationListWindow).mount("#app");
}

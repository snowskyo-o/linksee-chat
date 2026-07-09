import { createApp } from "vue";
import "../styles/main.css";
import ChatPage from "./ChatPage.vue";
import { bindSessionExpiredRedirect, requireAuth } from "../shared/session.js";

bindSessionExpiredRedirect();

if (requireAuth()) {
  createApp(ChatPage).mount("#app");
}

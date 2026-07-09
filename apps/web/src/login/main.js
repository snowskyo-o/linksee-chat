import { createApp } from "vue";
import "../styles/main.css";
import LoginPage from "./LoginPage.vue";
import { bindSessionExpiredRedirect } from "../shared/session.js";

bindSessionExpiredRedirect();

createApp(LoginPage).mount("#app");

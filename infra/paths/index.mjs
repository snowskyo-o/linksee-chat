import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "../..");
export const webDistDir = path.join(projectRoot, "apps", "web", "dist");
export const webStaticDir = webDistDir;

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The frontend consumes backend/contract/ (schemas, messages, fixtures) as the
// only shared surface. Those paths resolve one level up from frontend/.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@contract": fileURLToPath(new URL("../backend/contract", import.meta.url)),
      // The contract lives outside frontend/; point its `zod` import at the
      // frontend copy so Vite resolves it from here, not backend/node_modules.
      zod: fileURLToPath(new URL("./node_modules/zod", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});

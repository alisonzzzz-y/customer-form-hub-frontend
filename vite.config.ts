import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Set VITE_PROXY_TARGET (e.g. the Render backend URL) to have the dev server
// proxy /api same-origin — lets local dev talk to a deployed backend whose
// CORS allowlist doesn't include this port. Leave unset for plain local dev.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    server: env.VITE_PROXY_TARGET
      ? {
          proxy: {
            "/api": {
              target: env.VITE_PROXY_TARGET,
              changeOrigin: true,
              // Strip the browser's Origin header so the deployed backend's
              // CORS allowlist never engages — the proxy makes this a plain
              // server-to-server request, exactly like curl.
              configure: (proxy) =>
                proxy.on("proxyReq", (proxyReq) =>
                  proxyReq.removeHeader("origin"),
                ),
            },
          },
        }
      : undefined,
  };
});

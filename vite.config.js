import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const openaiApiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || "";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/openai": {
          target: "https://api.openai.com/v1",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/openai/, ""),
          headers: openaiApiKey
            ? {
                Authorization: `Bearer ${openaiApiKey}`,
              }
            : {},
        },
      },
    },
  };
});

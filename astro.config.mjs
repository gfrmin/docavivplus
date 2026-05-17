import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://docavivplus.gfrm.in",
  output: "static",
  vite: {
    build: { target: "es2022" },
  },
});

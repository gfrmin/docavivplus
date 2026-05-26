import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://docavivplus.gfrm.in",
  output: "static",
  integrations: [sitemap()],
  vite: {
    build: { target: "es2022" },
  },
});

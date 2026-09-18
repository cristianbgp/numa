// @ts-check

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import react from "@astrojs/react";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://numa.channel",

  // Numa does not use Astro sessions. The Cloudflare adapter otherwise
  // defaults to a persistent SESSION KV binding, so keep the unused store
  // process-local and avoid provisioning unnecessary infrastructure.
  session: {
    driver: "memory",
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
  adapter: cloudflare(),
});

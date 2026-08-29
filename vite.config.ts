// ============= Full file contents =============

// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig(({ mode }) => {
  // Load all env vars into process.env for server-side code only (server
  // functions/routes need non-VITE_ secrets like SUPABASE_SERVICE_ROLE_KEY).
  // These are NOT added to any define block, so nothing leaks to the client.
  const serverEnv = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, serverEnv);

  return {
    tanstackStart: {
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    },
    vite: {
      resolve: {
        alias: {
          // Pin entities deep imports to the hoisted v4.5.0 copy; a nested v7
          // copy removed ./lib/decode.js and breaks SSR.
          "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
          "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
          "entities": path.resolve(__dirname, "node_modules/entities"),
        },
      },
    },
  };
});

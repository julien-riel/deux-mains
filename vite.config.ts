import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

// Le jeu se construit en un seul fichier autonome, dist/deux-mains.html (ADR-0007).
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    rollupOptions: { input: "deux-mains.html" },
  },
  server: { open: "/deux-mains.html" },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});

import { defineConfig, type Plugin } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

// Le fichier publié garde son nom : dist/deux-mains.html, et non dist/index.html
const nommerDeuxMains = (): Plugin => ({
  name: "nommer-deux-mains",
  enforce: "post",
  generateBundle(_, bundle) {
    const page = bundle["index.html"];
    if (page) page.fileName = "deux-mains.html";
  },
});

// Le jeu se construit en un seul fichier autonome, dist/deux-mains.html (ADR-0007).
export default defineConfig({
  plugins: [viteSingleFile(), nommerDeuxMains()],
  server: { open: "/" },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});

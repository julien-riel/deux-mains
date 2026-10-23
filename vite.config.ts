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
    // Les simulations jouent des chansons entières : 5 s ne suffisent pas
    // quand la machine est chargée (#51)
    testTimeout: 30000,
    // La logique pure doit rester couverte par les tests (#3)
    coverage: {
      provider: "v8",
      include: ["src/chanson/**", "src/essais/**", "src/jeu/jugement.ts", "src/jeu/midi.ts", "src/jeu/variations.ts"],
      reporter: ["text"],
      thresholds: {
        "src/chanson/**": { lines: 90 },
        "src/essais/**": { lines: 90 },
        "src/jeu/jugement.ts": { lines: 90 },
        "src/jeu/midi.ts": { lines: 90 },
        "src/jeu/variations.ts": { lines: 90 },
      },
    },
  },
});

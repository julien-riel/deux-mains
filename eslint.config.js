import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// Séparation (ADR-0007) : la chanson et le jugement sont de la logique pure, testable sans faux navigateur
const ACCES_INTERDIT =
  "La chanson et le jugement restent de la logique pure (ADR-0007) : passer par des fonctions fournies.";

export default defineConfig([
  globalIgnores(["dist/", "node_modules/", ".claude/worktrees/"]),
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  // Les scènes (ADR-0019) ne fournissent que la géométrie et le décor : le jeu ne dépend d'aucune scène. Les modules
  // de jeu/ qui touchent à l'image passent par la scène en cours (rendu/geometrie.ts). La logique pure, plus bas,
  // n'importe rien du rendu.
  {
    files: ["src/jeu/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/rendu/scenes", "**/rendu/scenes/**"],
              message: "Le jeu ne dépend d'aucune scène (ADR-0019) : passer par la scène en cours (rendu/geometrie).",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/chanson/**/*.ts",
      "src/essais/**/*.ts",
      "src/sauvegarde/**/*.ts",
      "src/jeu/carte.ts",
      "src/jeu/jugement.ts",
      "src/jeu/calibrage.ts",
      "src/jeu/midi.ts",
      "src/jeu/pianiste.ts",
      "src/jeu/variations.ts",
      "src/jeu/style.ts",
      "src/jeu/enregistrement.ts",
      "src/jeu/jam.ts",
      "src/jeu/remontage.ts",
      "src/jeu/editeur.ts",
      "src/jeu/traces.ts",
      "src/jeu/fantome.ts",
      "src/jeu/scenes.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/rendu", "**/rendu/**", "**/audio", "**/audio/**", "**/ui", "**/ui/**"],
              message: ACCES_INTERDIT,
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...[
          "document",
          "window",
          "navigator",
          "localStorage",
          "AudioContext",
          "webkitAudioContext",
          "requestAnimationFrame",
        ].map((name) => ({ name, message: ACCES_INTERDIT })),
      ],
    },
  },
]);

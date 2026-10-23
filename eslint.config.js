import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// Séparation (ADR-0007) : la chanson et le jugement sont de la logique pure, testable sans faux navigateur
const ACCES_INTERDIT =
  "La chanson et le jugement restent de la logique pure (ADR-0007) : passer par des fonctions fournies.";

export default defineConfig([
  globalIgnores(["dist/", "node_modules/"]),
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ["src/chanson/**/*.ts", "src/essais/**/*.ts", "src/jeu/jugement.ts", "src/jeu/calibrage.ts"],
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

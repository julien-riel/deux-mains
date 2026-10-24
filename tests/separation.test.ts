// La règle de séparation d'ADR-0007 est vérifiée par ESLint : on s'assure ici qu'elle bloque vraiment.

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function reglesEnfreintes(chemin: string, code: string) {
  const [resultat] = await eslint.lintText(code, { filePath: chemin });
  return resultat.messages.map((m) => m.ruleId);
}

describe("séparation entre la logique pure et le navigateur", () => {
  it.each([
    ["src/chanson/generateur.ts", 'import { g } from "../rendu/outils";\nexport const x = g;'],
    ["src/chanson/generateur.ts", 'import { AC } from "../audio/moteur";\nexport const x = AC;'],
    ["src/jeu/jugement.ts", 'import { show } from "../ui/ecrans";\nexport const x = show;'],
    ["src/jeu/jugement.ts", 'import { leadV } from "../audio/instruments";\nexport const x = leadV;'],
  ])("%s ne peut pas importer : %s", async (chemin, code) => {
    expect(await reglesEnfreintes(chemin, code)).toContain("no-restricted-imports");
  });

  it.each([
    ["src/chanson/theorie.ts", "export const x = document.title;"],
    ["src/jeu/jugement.ts", "export const x = new AudioContext();"],
    ["src/jeu/jugement.ts", "export const x = window.innerWidth;"],
  ])("%s ne peut pas utiliser le navigateur : %s", async (chemin, code) => {
    expect(await reglesEnfreintes(chemin, code)).toContain("no-restricted-globals");
  });

  it("les autres modules peuvent utiliser l'audio et le DOM", async () => {
    const code = 'import { AC } from "../audio/moteur";\nexport const x = [AC, document.title];';
    expect(await reglesEnfreintes("src/jeu/deroulement.ts", code)).toEqual([]);
  });
});

// Les scènes (ADR-0019) ne fournissent que la géométrie et le décor : le jeu et la chanson n'en dépendent pas
describe("séparation entre le jeu et les scènes", () => {
  it.each([
    ["src/jeu/effets.ts", 'import { COTE } from "../rendu/scenes/cote";\nexport const x = COTE;'],
    ["src/jeu/deroulement.ts", 'import type { Scene } from "../rendu/scenes/contrat";\nexport let x: Scene;'],
    ["src/jeu/jugement.ts", 'import { COTE } from "../rendu/scenes/cote";\nexport const x = COTE;'],
    ["src/chanson/generateur.ts", 'import { COTE } from "../rendu/scenes/cote";\nexport const x = COTE;'],
  ])("%s ne peut pas importer une scène : %s", async (chemin, code) => {
    expect(await reglesEnfreintes(chemin, code)).toContain("no-restricted-imports");
  });

  it("les effets du jugement passent par la scène en cours", async () => {
    const code = 'import { scene } from "../rendu/geometrie";\nexport const x = scene;';
    expect(await reglesEnfreintes("src/jeu/effets.ts", code)).toEqual([]);
  });
});

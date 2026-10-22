# Registre des décisions d'architecture (ADR)

Chaque décision structurante du projet est consignée ici, une par fichier. Le processus est décrit dans [ADR-0001](0001-consigner-les-decisions-dans-des-adr.md).

## Index

| N° | Décision | Statut | Date |
|---|---|---|---|
| [0001](0001-consigner-les-decisions-dans-des-adr.md) | Consigner les décisions d'architecture dans des ADR | Acceptée | 2026-10-22 |
| [0002](0002-prototype-en-un-seul-fichier-html.md) | Livrer le prototype en un seul fichier HTML sans dépendance | Remplacée par [0007](0007-modules-vite-typescript-et-outillage.md) | 2026-10-21 |
| [0003](0003-couloirs-en-degres-de-l-accord.md) | Faire jouer des degrés de l'accord, pas des notes fixes | Acceptée | 2026-10-21 |
| [0004](0004-horloge-audio-comme-reference-du-temps.md) | Prendre l'horloge audio comme référence du temps | Acceptée | 2026-10-21 |
| [0005](0005-chansons-generees-par-graine.md) | Générer les chansons à partir d'une graine déterministe | Acceptée | 2026-10-21 |
| [0006](0006-univers-interchangeables.md) | Séparer les univers des mécaniques de jeu | Acceptée | 2026-10-22 |
| [0007](0007-modules-vite-typescript-et-outillage.md) | Passer à des modules TypeScript construits avec Vite, testés avec Vitest | Acceptée | 2026-10-22 |

## Écrire un ADR

1. Copier [`0000-modele.md`](0000-modele.md) sous le prochain numéro libre, avec un titre court à l'infinitif.
2. Remplir le contexte, les options, la décision et les conséquences.
3. Ajouter une ligne à l'index ci-dessus.
4. Pour remplacer une décision, écrire un nouvel ADR et passer l'ancien au statut « Remplacée par ADR-XXXX ».

Les statuts possibles : **Proposée** (en attente d'un choix), **Acceptée**, **Remplacée par ADR-XXXX**, **Abandonnée**.

# Registre des décisions d'architecture (ADR)

Chaque décision structurante du projet est consignée ici, une par fichier. Le processus est décrit dans [ADR-0001](0001-consigner-les-decisions-dans-des-adr.md).

## Index

| N°                                                                | Décision                                                                                            | Statut                                                                                                | Date       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| [0001](0001-consigner-les-decisions-dans-des-adr.md)              | Consigner les décisions d'architecture dans des ADR                                                 | Acceptée                                                                                              | 2026-10-22 |
| [0002](0002-prototype-en-un-seul-fichier-html.md)                 | Livrer le prototype en un seul fichier HTML sans dépendance                                         | Remplacée par [0007](0007-modules-vite-typescript-et-outillage.md)                                    | 2026-10-21 |
| [0003](0003-couloirs-en-degres-de-l-accord.md)                    | Faire jouer des degrés de l'accord, pas des notes fixes                                             | Acceptée                                                                                              | 2026-10-21 |
| [0004](0004-horloge-audio-comme-reference-du-temps.md)            | Prendre l'horloge audio comme référence du temps                                                    | Acceptée                                                                                              | 2026-10-21 |
| [0005](0005-chansons-generees-par-graine.md)                      | Générer les chansons à partir d'une graine déterministe                                             | Acceptée                                                                                              | 2026-10-21 |
| [0006](0006-univers-interchangeables.md)                          | Séparer les univers des mécaniques de jeu                                                           | Acceptée                                                                                              | 2026-10-22 |
| [0007](0007-modules-vite-typescript-et-outillage.md)              | Passer à des modules TypeScript construits avec Vite, testés avec Vitest                            | Acceptée                                                                                              | 2026-10-22 |
| [0008](0008-commandes-tactiles.md)                                | Jouer au doigt avec deux grandes zones et des accords à un pouce                                    | Acceptée (zones remplacées par [0019](0019-scenes-interchangeables-une-par-lieu.md))                  | 2026-10-22 |
| [0009](0009-derouler-les-boucles-dans-le-temps-de-la-partie.md)   | Dérouler les boucles dans le temps de la partie                                                     | Acceptée                                                                                              | 2026-10-22 |
| [0010](0010-notes-hors-accord-ecrites-par-le-generateur.md)       | Faire écrire les notes hors accord par le générateur, la touche ne choisissant qu'un geste          | Acceptée                                                                                              | 2026-10-22 |
| [0011](0011-touches-midi-en-position-fixe.md)                     | Traduire les touches MIDI en position fixe, avec un mode pianiste à venir                           | Acceptée                                                                                              | 2026-10-22 |
| [0012](0012-variations-de-la-partie-et-reprise-du-solo.md)        | Garder le solo comme variation de la partie, et tirer l'improvisation de l'auto-play de la graine   | Acceptée                                                                                              | 2026-10-22 |
| [0013](0013-grille-de-reference-de-douze-pas-par-temps.md)        | Garder le temps en nombre, sur une grille de référence de douze pas par temps                       | Acceptée                                                                                              | 2026-10-23 |
| [0014](0014-sauvegarde-versionnee-et-code-de-sauvegarde.md)       | Garder la progression dans un document versionné du navigateur, avec un code de sauvegarde à copier | Acceptée (un point remplacé par [0017](0017-fantomes-hors-du-code-de-sauvegarde.md))                  | 2026-10-23 |
| [0015](0015-une-mecanique-commune-habillee-par-chaque-univers.md) | Garder chaque mécanique commune aux univers, chacun ne fournissant que son habillage                | Acceptée                                                                                              | 2026-10-23 |
| [0016](0016-partitions-ecrites-a-la-main.md)                      | Écrire les chansons à la main en partitions de motifs par mesure, compilées en chanson              | Acceptée (deux points remplacés par [0018](0018-accords-ecrits-et-repertoire-de-chansons-connues.md)) | 2026-10-23 |
| [0017](0017-fantomes-hors-du-code-de-sauvegarde.md)               | Garder les fantômes sur l'appareil, hors du code de sauvegarde                                      | Acceptée                                                                                              | 2026-10-23 |
| [0018](0018-accords-ecrits-et-repertoire-de-chansons-connues.md)  | Écrire les accords des partitions pour jouer des chansons connues, rangées dans un répertoire       | Acceptée                                                                                              | 2026-10-24 |
| [0019](0019-scenes-interchangeables-une-par-lieu.md)              | Représenter la musique par des scènes interchangeables, une par lieu                                | Acceptée                                                                                              | 2026-10-24 |

## Écrire un ADR

1. Copier [`0000-modele.md`](0000-modele.md) sous le prochain numéro libre, avec un titre court à l'infinitif.
2. Remplir le contexte, les options, la décision et les conséquences.
3. Ajouter une ligne à l'index ci-dessus.
4. Pour remplacer une décision, écrire un nouvel ADR et passer l'ancien au statut « Remplacée par ADR-XXXX ».

Les statuts possibles : **Proposée** (en attente d'un choix), **Acceptée**, **Remplacée par ADR-XXXX**, **Abandonnée**.

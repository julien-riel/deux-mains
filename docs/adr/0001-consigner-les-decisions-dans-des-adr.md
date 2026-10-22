# ADR-0001 : Consigner les décisions d'architecture dans des ADR

- **Statut** : Acceptée
- **Date** : 2026-10-22
- **Issues liées** : aucune

## Contexte

Le projet passe d'un prototype exploratoire à un développement organisé en issues. Plusieurs choix structurants ont déjà été faits pendant le prototypage (format du jeu, système de couloirs, horloge audio, univers). Sans trace écrite, chaque nouvelle issue risque de les remettre en cause sans le savoir.

## Options considérées

### Option A : ADR en Markdown dans le dépôt

Un fichier par décision dans `docs/adr/`, versionné avec le code, indexé dans `docs/adr/README.md`.

### Option B : décisions dans les issues GitHub

Pas de fichier, la discussion de l'issue fait foi. Plus léger, mais les décisions se perdent dans le fil des commentaires et ne suivent pas le code.

## Décision

Option A. Chaque décision structurante a un ADR numéroté dans `docs/adr/`, rédigé à partir de `0000-modele.md` et listé dans l'index.

Quand une décision doit être prise, Claude publie d'abord une page de décision (artefact) avec le contexte, des diagrammes, des exemples, les options et une recommandation. L'ADR est écrit une fois le choix fait (skill `decision-adr`).

Un ADR accepté ne se modifie pas sur le fond : on le remplace par un nouvel ADR, et l'ancien passe au statut « Remplacée par ».

## Conséquences

- **Positives** : les skills `ecrire-issue` et `implementer-issue` peuvent vérifier qu'une issue respecte les décisions en vigueur.
- **Négatives** : un peu d'écriture en plus pour chaque décision.
- **À surveiller** : si des ADR sont contournés sans être remplacés, le registre ne sert plus à rien.

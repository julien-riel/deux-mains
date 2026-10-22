# ADR-0005 : Générer les chansons à partir d'une graine déterministe

- **Statut** : Acceptée
- **Date** : 2026-10-21
- **Issues liées** : aucune

## Contexte

On veut beaucoup de chansons sans les composer une par une, mais il faut aussi pouvoir rejouer, partager et tester exactement la même chanson.

## Options considérées

### Option A : chansons composées à la main

Qualité maîtrisée, mais peu de contenu et beaucoup de travail par niveau.

### Option B : génération aléatoire libre

Contenu infini, mais impossible de rejouer ou de partager une chanson.

### Option C : génération déterministe à partir d'une graine

Un même nombre produit toujours la même chanson.

## Décision

Option C. La graine (1 à 99 999) et la difficulté déterminent toute la chanson, à travers un générateur pseudo-aléatoire (`mulberry32`) :

- tonalité, tempo (88 à 112 BPM) et progression d'accords parmi une liste choisie ;
- forme fixe : Intro, Couplet, Refrain, Solo libre, Refrain, Outro ;
- basse selon des motifs rythmiques propres à chaque difficulté ;
- mélodie faite d'un motif de 2 mesures, répété et varié, en question-réponse ;
- accords à une et à deux mains.

Seuls le décor et l'improvisation de l'auto-play pendant le solo peuvent utiliser `Math.random()`, car ils ne changent pas la chanson elle-même.

## Conséquences

- **Positives** : chanson du jour, partage d'un code, classements par graine, et tests reproductibles.
- **Négatives** : la qualité musicale dépend entièrement des règles du générateur.
- **À surveiller** : changer le générateur change toutes les chansons existantes ; il faudra versionner le générateur si on publie des classements.

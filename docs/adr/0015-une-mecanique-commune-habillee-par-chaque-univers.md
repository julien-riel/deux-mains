# ADR-0015 : Garder chaque mécanique commune aux univers, chacun ne fournissant que son habillage

- **Statut** : Acceptée
- **Date** : 2026-10-23
- **Issues liées** : #27
- **Artefact de décision** : https://claude.ai/artifact/DHPaMew5QGbfRt9tyNHYcB (question 3)

## Contexte

L'issue #27 proposait un mini-jeu propre à la Boîte : entre deux souvenirs, remonter la clé de la boîte à musique en rythme pendant quatre mesures, le résultat fixant le ressort (la jauge d'harmonie) au départ du souvenir suivant, entre 60 et 100. ADR-0006 dit qu'un univers ne change que l'habillage, et qu'« un univers ne peut pas avoir de mécanique propre sans un nouvel ADR ». D'autres idées du même genre attendent (un album dans la Boîte, des graffitis dans la Ville, un éditeur de cylindre) : il faut une règle qui vaille pour toutes.

Ce qui était vrai avant cette décision :

- Un univers est un objet de textes et de couleurs (`Univers`, `src/univers/univers.ts`) ; ses décors sont dans `src/rendu/ville.ts` et `src/rendu/boite.ts`, ses timbres dans `src/audio/instruments.ts` (`boite()`, `leadTimbre`), ce qu'ADR-0006 permet.
- La logique de jeu ne lit pas l'univers : aucun `S.theme` dans `src/jeu/` ni `src/chanson/`.
- L'harmonie démarrait toujours à 100 (`resetRun`, `src/jeu/deroulement.ts`).
- L'enchaînement des lieux vient de la carte du monde (#25) : « Suivant : <lieu> » (`enchainer()`, `src/ui/carte.ts`).

## Options considérées

### Option 3A : non, une mécanique est commune, chaque univers l'habille

ADR-0006 reste entier. Le remontage devient un mini-jeu des deux univers : la clé dans la Boîte, la manivelle d'un groupe électrogène qui rallume le quartier dans la Ville. Même logique, mêmes règles, deux habillages. Aucune exception à ADR-0006, une seule logique à tester, des univers équivalents ; mais chaque idée d'univers doit trouver son double dans l'autre, ce qui force parfois l'habillage. Coût moyen (deux habillages), facile à défaire.

### Option 3B : oui, entre les chansons seulement (recommandée par la page de décision)

Pendant une chanson, ADR-0006 vaut sans exception ; entre les chansons, un univers peut proposer ses propres séquences (entractes), à des conditions écrites : logique pure dans `jeu/`, un seul paramètre de départ borné comme effet, auto-play et essai, équivalent dans l'autre univers facultatif. Plus de liberté là où elle ne gêne pas la lecture du jeu, mais des univers inégaux hors des chansons.

### Option 3C : oui, même pendant la chanson, par des règles d'univers

Un univers active des modules de règles pendant la chanson (un ennemi propre, une jauge qui fonctionne autrement). Les univers peuvent vraiment différer, mais une graine ne se joue plus pareil d'un univers à l'autre (scores et fantômes à séparer), chaque correction se vérifie deux fois, et la porte s'ouvre aux `if (S.theme === …)` dans la logique. Remplacerait ADR-0006 ; coûteux et difficile à défaire.

## Décision

Option 3A : un univers n'a pas de mécanique propre. Toute mécanique, pendant une chanson comme entre deux chansons, est commune à tous les univers ; chaque univers ne fait que l'habiller. Cet ADR confirme et précise ADR-0006 sans le remplacer.

Les règles :

- **Une mécanique se définit dans `jeu/`, en logique pure**, et vaut pour tous les univers : ses règles, son jugement et son effet sont les mêmes partout. Son module est sous la règle ESLint des modules purs (ADR-0007) et sous le seuil de couverture de 90 % des lignes.
- **Un univers n'en fournit que l'habillage** : textes (dans `Univers`), couleurs, dessins (`rendu/ville.ts`, `rendu/boite.ts`), timbres (`audio/instruments.ts`). Pas de `S.theme` dans `jeu/` ni `chanson/`, et pas de champ d'`Univers` qui active ou désactive une mécanique.
- **Les couleurs des mains et des couloirs restent celles d'ADR-0006** dans toute mécanique : ambre pour la gauche, cyan pour la droite.
- **Toute mécanique a son auto-play et son essai** : l'auto-play la réussit, et un essai par univers la montre directement (`src/essais/registre.ts`).
- **Une nouvelle mécanique arrive dans tous les univers à la fois.** Si une idée n'a de sens que dans un univers, il faut lui trouver un habillage dans les autres, ou un nouvel ADR qui remplace celui-ci.

### Le premier cas : le remontage entre deux lieux (#27)

- `src/jeu/remontage.ts` : une mesure de décompte, puis quatre mesures, huit tours, un tous les deux temps, à la main gauche puis à la main droite. Les fenêtres de jugement sont celles de la difficulté. Un appui juge le tour en attente de sa main le plus proche, s'il est à moins d'un temps : dans la fenêtre, il est réussi ; hors de la fenêtre, raté. L'harmonie de départ du lieu suivant vaut `60 + 40 × réussis / 8`, arrondie (7 tours sur 8 donnent 95).
- Habillages : la clé de la boîte à musique et son ressort spiral (Boîte) ; la manivelle du groupe électrogène, dont chaque tour réussi rallume une rangée de fenêtres (Ville). Le cliquet, les crans, le moteur qui tousse ou le ressort qui dérape changent de timbre avec l'univers.
- Il se lance par « Suivant » (`→`), entre deux lieux, au tempo de la chanson du lieu suivant ; choisir un lieu sur la carte ne le lance pas. Son résultat vaut pour les parties de cette chanson et n'est pas sauvegardé (ADR-0014).

## Conséquences

- **Positives** : une mécanique se corrige et se teste une seule fois ; les deux univers restent équivalents ; une graine, une partie et un remontage se jouent pareil partout, et ADR-0006 ne connaît aucune exception.
- **Négatives** : chaque idée propre à un univers demande un second habillage, parfois forcé ; un univers ne peut pas se distinguer par ses règles.
- **À surveiller** : une idée qui ne trouve vraiment pas d'habillage dans l'autre univers, ou des habillages qui deviennent artificiels. Il faudrait alors un nouvel ADR, probablement l'option 3B (entractes propres à un univers, hors des chansons).

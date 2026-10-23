# ADR-0012 : Garder le solo comme variation de la partie, et tirer l'improvisation de l'auto-play de la graine

- **Statut** : Acceptée
- **Date** : 2026-10-22
- **Issues liées** : #9
- **Artefact de décision** : https://claude.ai/artifact/7Cp15CzVv4eDnw9i7MBeLN (question 1)

## Contexte

L'issue #9 fait revenir la meilleure phrase du solo libre dans une phrase sur deux du dernier refrain. ADR-0005 dit que « la graine et la difficulté déterminent toute la chanson », et n'autorise `Math.random()` que pour le décor et l'improvisation de l'auto-play, « car ils ne changent pas la chanson elle-même ». Si ce que joue le joueur, ou l'improvisation aléatoire de l'auto-play, revenait dans la chanson, une graine ne redonnerait plus la même chanson.

Ce qui était vrai avant cette décision :

- `buildSong(seed, diffKey)` est pure ; l'instantané `tests/instantanes/chansons.json` le vérifie.
- La forme est fixe : Intro (mesures 0–1), Couplet (2–9), Refrain (10–17), Solo libre (18–21), Refrain (22–29), Outro (30–31). Le dernier refrain suit le solo sans transition.
- Pendant le solo, un tir (`rightPress`) fait sonner la note et rapporte 25 points ; rien n'est gardé. L'auto-play improvise avec `Math.random()` (`autoSolo`), en auto-play complet comme en mode une main « gauche ».
- ADR-0009 a séparé la chanson générée `S.song`, qui ne change pas pendant une partie, des notes de la partie `S.ev`, que lisent le jugement, le séquenceur, l'auto-play et le dessin.
- L'écran montre les notes 6,3 temps à l'avance (`(W - HITX) / PPB`, `rendu/scene.ts`). La phrase 1 du dernier refrain entre à l'écran avant la fin du solo ; la phrase 2 y entre 1,7 temps après. Seules les phrases 2 et 4 peuvent être remplacées à temps.

## Options considérées

### Option 1A : chanson de base et variations de la partie ; l'auto-play ne compose pas

La graine détermine toujours la chanson (`S.song`). La partie garde en plus les notes du solo jouées par une personne ; à la fin du solo, une fonction pure choisit la meilleure phrase et fabrique les notes des phrases 2 et 4 dans `S.ev`, comme la boucle fabrique ses passages. Quand la main droite est en auto-play, rien n'est gardé. ADR-0005 reste vraie sans changement, mais l'auto-play ne montre pas la fonction.

### Option 1B : comme 1A, et l'improvisation de l'auto-play tirée de la graine

Même mécanisme que 1A, mais l'auto-play improvise avec un générateur pseudo-aléatoire initialisé par la graine au lieu de `Math.random()`. Ses notes sont gardées comme celles d'une personne, et sa phrase revient dans le refrain, toujours la même pour une graine. La démonstration montre la fonction et la simulation peut la tester de bout en bout ; en mode une main « gauche », c'est le bot qui compose le refrain, et le dernier refrain des simulations en auto-play change.

### Option 1C : modifier la chanson elle-même

On remplace les notes du dernier refrain dans `S.song.ev`. Peu de code au départ, mais la graine ne redonne plus la chanson, la partie suivante garde le refrain modifié (`resetRun` réutilise `S.song.ev`), les boucles copieraient une chanson modifiée, et ADR-0009 serait à revoir. Remplace ADR-0005.

### Option 1D : écho sonore seulement

La phrase revient en contre-chant joué par le séquenceur, sans toucher aux ennemis. ADR-0005 reste intacte, mais le joueur entend sa phrase sans la rejouer : il n'est plus compositeur, et l'issue #9 perd ses ennemis issus du solo.

## Décision

Option 1B. La graine fait la chanson ; la partie garde ses variations, et l'auto-play improvise à partir de la graine. Cet ADR complète ADR-0005 sans la remplacer : la chanson reste entièrement déterminée par la graine et la difficulté, et l'improvisation de l'auto-play n'utilise simplement plus la permission de `Math.random()`.

Règles :

- **`S.song` reste la chanson de la graine.** Les variations vivent dans l'état de la partie (`S.reprise`) et dans ses notes (`S.ev`), jamais dans `S.song`. Rejouer la graine, ou lancer une nouvelle partie, redonne la chanson de base.
- **Ce qui est gardé** : chaque note jouée pendant le solo libre qui précède le dernier refrain, par une personne (clavier, tactile, MIDI, joueur de la mélodie en duo) ou par l'auto-play, avec son couloir et sa croche depuis le début du solo, recalée sur la croche la plus proche. Une seule note par croche, la première.
- **L'improvisation de l'auto-play** est une fonction pure de la graine de la chanson (`improviser`, `mulberry32(graine * 7919 + 1)`) : une note par croche une fois sur deux à peu près, par degrés voisins. Elle s'applique en auto-play complet et en mode une main « gauche » ; la phrase qui revient est donc toujours la même pour une graine. En mode une main « droite » et en duo, c'est la personne qui joue la mélodie qui compose.
- **Le choix de la phrase** se fait quand le temps de la partie atteint la fin du solo (`reprendreLeSolo`, appelé par `update`). Avec moins de trois notes au solo, rien ne change. Sinon, parmi les phrases de deux mesures qui commencent sur une mesure du solo, on garde celle qui a le plus de notes, puis le plus de couloirs différents, avec un bonus si elle finit sur la fondamentale ; à égalité, la plus récente.
- **La phrase suit la difficulté** : au plus `max` notes de la mélodie de la difficulté (5, 6, 9, 11), les mieux placées dans la mesure ; recalée sur le temps quand la difficulté ne joue pas à contretemps (Débutant et Facile). Ses notes ne sont pas tenues.
- **Les phrases remplacées** sont une sur deux à partir de la deuxième : la 2ᵉ et la 4ᵉ du dernier refrain (mesures 24–25 et 28–29). La mélodie du générateur y laisse la place à la phrase, qui joue le degré de l'accord de chaque mesure (ADR-0003). Les notes de basse de ces phrases sont copiées dans `S.ev` pour relier les nouveaux accords à deux mains sans modifier `S.song`.
- **Les notes reprises** sont marquées (`reprise: true`) : le dessin les distingue, et une bannière annonce « Le refrain reprend ton solo » (« le solo » quand la main droite est en auto-play).
- **Mort et reprise** : une mort après la fin du solo garde la phrase à la reprise ; une mort avant efface les notes gardées, et l'enregistrement recommence. Une fois choisie, la phrase reste jusqu'à la fin de la partie.
- **Boucle** (ADR-0009) : en boucle, rien n'est gardé ni repris.

## Conséquences

- **Positives** : la graine reste reproductible, auto-play compris ; l'instantané du générateur ne change pas. La démonstration en auto-play montre la fonction, et la simulation la teste. Une partie se décrit par « graine, difficulté, solo », de quoi la réécouter ou en faire un fantôme plus tard. Le mécanisme est celui de la boucle, déjà en place.
- **Négatives** : en mode une main « gauche », c'est le bot qui compose le refrain du joueur. Deux joueurs sur la même graine n'ont pas tout à fait le même dernier refrain : à encadrer si on publie des classements. Les tests qui comptent les notes jouées doivent compter celles de la partie (`S.ev`), pas celles de la chanson.
- **À surveiller** : une lecture de `S.song.ev` pendant la partie (déjà interdite par ADR-0009), qui manquerait la phrase reprise ; une lecture de l'écran plus en avance (`PPB`, largeur de la scène), qui ferait entrer la phrase 2 avant la fin du solo ; un changement de la forme fixe, qui demanderait de revoir quelles phrases peuvent être remplacées.

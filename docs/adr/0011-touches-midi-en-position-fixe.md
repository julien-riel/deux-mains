# ADR-0011 : Traduire les touches MIDI en position fixe, avec un mode pianiste à venir

- **Statut** : Acceptée
- **Date** : 2026-10-22
- **Issues liées** : #10, #53 (mode pianiste)
- **Artefact de décision** : https://claude.ai/artifact/7Cp15CzVv4eDnw9i7MBeLN (question 2)

## Contexte

L'issue #10 fait jouer le jeu avec un clavier de piano MIDI. Web MIDI livre des numéros de note de 0 à 127, où le Do central (Do4) vaut 60, et le jeu doit les traduire en actions.

Ce qui est vrai aujourd'hui :

- ADR-0008, règle 1 : le jeu reçoit des actions horodatées (`sauter`, `glisser`, `ecraser`, `couloir0` à `couloir3`) par `presser` et `relacher` (`src/jeu/actions.ts`). Le clavier (`ACTION_DE`) et le tactile (`zone()`) traduisent leurs événements sans rien savoir de la chanson. Le MIDI y est annoncé.
- ADR-0008, règle 2 : une action est jugée à l'heure de l'événement. Les messages Web MIDI ont un `timeStamp` sur la même base que les événements du toucher.
- ADR-0003 : chaque action joue un degré de l'accord en cours ; le son vient du jeu, jamais de la touche.
- Les chansons sont dans les douze tonalités : la tonique tombe sur une touche noire dans 5 cas sur 12.
- Web MIDI n'existe que dans Chrome et Edge, et la page d'artefact claude.ai refuse l'accès aux périphériques. Un petit clavier de 25 touches couvre Do3 à Do5 (MIDI 48 à 72).

Le choix décide qui peut jouer au clavier MIDI (tout le monde, ou des pianistes) et si la traduction doit connaître la chanson.

## Options considérées

### Option 2A : position fixe

Sept touches blanches, placées par rapport au point de séparation (Do4 par défaut), correspondent chacune à une action. Une table pure traduit les messages en `presser` et `relacher`, comme `ACTION_DE` pour le clavier. Les autres touches ne font rien.

Avantages : respecte ADR-0008 telle quelle, même difficulté qu'au clavier d'ordinateur (scores comparables), jouable sans savoir lire la musique, tient sur un clavier de 25 touches. Inconvénients : ce n'est pas un exercice de piano (on presse Do-Mi-Sol quel que soit l'accord), et sur un piano à haut-parleurs la touche pressée sonne faux contre le jeu.

### Option 2B : vraie hauteur

Il faut jouer la note demandée : la hauteur reçue, à l'octave près, doit être celle de la note attendue dans la fenêtre de jugement. Avantages : un vrai exercice de piano, le son du piano et celui du jeu coïncident. Inconvénients : la traduction dépend de la chanson et du temps (exception à ADR-0008, règle 1), glisser et écraser jouent la même note, le solo libre demande une règle à part, et le jeu devient réservé aux pianistes. Coût élevé, difficile à défaire.

### Option 2C : les deux, au choix

La position fixe par défaut, et un réglage « mode pianiste » qui passe en vraie hauteur. L'ADR prévoit les deux : la position fixe sort avec #10, le mode pianiste suit dans une issue à part. Avantages : chacun trouve son mode, et le mode pianiste n'attend pas un nouvel ADR. Inconvénients : tous les coûts de 2B, plus deux modes à tester et à expliquer, et des scores à séparer par mode.

## Décision

**2C.** Le clavier MIDI joue en position fixe par défaut, livrée avec #10 ; un mode pianiste en vraie hauteur est prévu ici et livré dans une issue suivante.

Règles concrètes de la position fixe :

1. **Une table sans état** (`src/jeu/midi.ts`, logique pure) traduit une note en action, par son écart au point de séparation :

   | Touche (séparation Do4) | Note MIDI | Écart | Action                            | Ce qu'on entend          |
   | ----------------------- | --------- | ----- | --------------------------------- | ------------------------ |
   | Do3                     | 48        | −12   | `glisser`                         | fondamentale grave       |
   | Mi3                     | 52        | −8    | `ecraser`                         | fondamentale accentuée   |
   | Sol3                    | 55        | −5    | `sauter` (en l'air : double saut) | octave, puis quinte      |
   | Do4                     | 60        | 0     | `couloir0`                        | fondamentale de l'accord |
   | Mi4                     | 64        | +4    | `couloir1`                        | tierce                   |
   | Sol4                    | 67        | +7    | `couloir2`                        | quinte                   |
   | Do5                     | 72        | +12   | `couloir3`                        | octave                   |

   La table ne lit ni la chanson ni le temps : elle est au niveau de `ACTION_DE` (ADR-0008, règle 1).

2. **Point de séparation réglable** : le réglage MIDI choisit un Do, de Do2 à Do6 (Do4 par défaut), retenu d'une visite à l'autre. Les sept touches se déplacent ensemble ; les touches sous la séparation commandent la main gauche, celles au-dessus la main droite.
3. **Messages** : un `noteon` de vélocité non nulle presse, un `noteoff` ou un `noteon` de vélocité 0 relâche, sur tous les canaux. Une note maintenue tient la note longue (tunnel, pente, ennemi allongé), comme une touche maintenue. Le relâchement va à l'action pressée par cette note, même si la séparation a changé entre-temps. Les autres messages (pédale, contrôleurs, horloge) sont ignorés, et la vélocité ne change rien.
4. **Heure** : une action MIDI est jugée au `timeStamp` du message, ramené sur l'horloge de la chanson (ADR-0004, ADR-0008 règle 2), comme un toucher.
5. **Accords** : au MIDI, un accord demande toutes ses touches, comme au clavier d'ordinateur ; l'exception à un pouce reste réservée au tactile (ADR-0008, règle 5).
6. **Touches hors de la table** : elles ne font rien, sans pénalité. Le double saut est un second Sol3 joué en l'air.
7. **Toutes les commandes ensemble** : le clavier d'ordinateur, le tactile et le MIDI envoient les mêmes actions en même temps. En duo (#6), les deux joueurs peuvent se partager le clavier MIDI, ou l'un jouer au MIDI et l'autre au clavier d'ordinateur.
8. **Sans Web MIDI**, ou si l'accès est refusé (page d'artefact), le jeu fonctionne normalement : il l'indique discrètement dans les réglages, sans erreur.

Ce que fera le mode pianiste (#53) :

- un réglage « Mode pianiste », désactivé par défaut, à côté du point de séparation ;
- la note reçue est comparée aux notes en attente dans la fenêtre de jugement, à l'octave près (note modulo 12) : main droite, fondamentale, tierce, quinte et fondamentale à l'octave pour les quatre couloirs, l'octave départageant les couloirs 0 et 3 ; main gauche, la fondamentale sous la séparation pour glisser, la même une octave plus haut pour sauter, la quinte pour le double saut ; une règle propre pour écraser (par exemple fondamentale et quinte ensemble) ;
- c'est la seule exception admise à ADR-0008, règle 1 : dans ce mode, la traduction peut lire les notes attendues, mais elle appelle toujours `presser` et `relacher`, jamais le jugement directement ;
- dans le solo libre, toute note de l'accord compte, les autres sont des erreurs ;
- les scores du mode pianiste sont signalés comme tels, et ne se comparent pas à ceux de la position fixe.

## Conséquences

- **Positives** : le clavier MIDI se joue tout de suite, par tout le monde, au même niveau que le clavier d'ordinateur ; la traduction reste testable sans navigateur ; le mode pianiste a sa place sans nouvel ADR.
- **Négatives** : en position fixe, ce n'est pas un exercice de piano ; sur un piano à haut-parleurs, il faut baisser son volume. Le mode pianiste coûtera un nouveau chemin de traduction et deux modes à tester.
- **À surveiller** : si les musiciens réclament surtout la vraie hauteur, avancer le mode pianiste ; si la position fixe gêne sur les petits claviers (moins de 25 touches), proposer d'autres points de séparation.

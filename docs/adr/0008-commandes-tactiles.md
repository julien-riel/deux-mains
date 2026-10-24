# ADR-0008 : Jouer au doigt avec deux grandes zones et des accords à un pouce

- **Statut** : Acceptée (les règles 3 et 4, zones gauche et droite, sont remplacées par [ADR-0019](0019-scenes-interchangeables-une-par-lieu.md))
- **Date** : 2026-10-22
- **Issues liées** : #11, #10
- **Artefact de décision** : https://claude.ai/artifact/4mHXXY9GGAYgtGvQnkJXvV

## Contexte

Le jeu se partage par un lien, et la plupart des gens l'ouvrent sur un téléphone, où il faut aujourd'hui un clavier. Sur téléphone, on tient l'appareil en paysage avec les deux mains : chaque main n'a qu'un pouce pour jouer.

Trois questions se posaient :

- comment le pouce gauche saute et glisse ;
- comment le pouce droit joue un accord, alors qu'un pouce ne touche qu'une zone à la fois : en Facile et en Normal, chaque note de la main droite a 12 à 16 % de chances de devenir un accord de deux couloirs (voisins, ou séparés d'un couloir), et comme les motifs se répètent, une chanson en compte souvent des dizaines ;
- où placer les zones sans cacher la scène.

Les fenêtres de jugement sont étroites (« Bien » à ±160 ms en Facile, ±125 ms en Normal) : une commande qui doit attendre un geste avant d'agir mange une partie de cette marge. Les mécaniques à venir (trilles #15, glissando #16, écrasement #8) devront suivre la règle choisie ici, et le MIDI (#10) passera par la même couche d'entrée.

## Options considérées

### Main gauche

- **A1, deux boutons** : la moitié haute de la zone fait sauter, la moitié basse fait glisser ; l'action part au contact. Aucune latence, le « tenu » est naturel ; il faut sentir la limite entre les deux moitiés.
- **B1, gestes** : balayer vers le haut ou vers le bas. Pas besoin de viser, mais le jeu ne réagit qu'une fois le geste reconnu (40 à 80 ms), et un geste trop court est perdu.
- **C1, boutons et gestes** : ce que proposait l'issue. Hérite du délai des gestes, ambigu, le plus coûteux.

### Accords de la main droite

- **A2, un couloir de l'accord suffit** : en tactile, toucher l'un des couloirs d'un accord joue tout l'accord. La chanson et le clavier ne changent pas.
- **B2, le couloir le plus bas** : l'accord se joue en touchant son couloir le plus grave. Règle nette, mais piège : on vise la note la plus visible.
- **C2, glisser d'une zone à l'autre** : le pouce posé joue les couloirs où il entre. Trop lent pour les fenêtres de jugement, et ambigu pour le couloir traversé (accord 0+2).
- **D2, aucune règle spéciale** : injouable en tenant le téléphone.

### Mise en page

- **A3, chaque moitié de l'écran** : la scène occupe tout l'écran ; la moitié gauche commande la basse, la moitié droite est coupée en quatre bandes à la hauteur des couloirs.
- **B3, colonnes à côté de la scène** : rien ne cache la scène, mais elle perd près d'un tiers de sa taille et les boutons ne s'alignent plus sur les couloirs.

## Décision

**A1 + A2 + A3.** Le jeu se joue au doigt avec deux grandes zones, sans geste à reconnaître, et un pouce joue un accord entier.

Règles concrètes :

1. **Actions, pas touches.** Le jeu reçoit des actions horodatées : `sauter`, `glisser`, `couloir0` à `couloir3` (`src/jeu/actions.ts`, fonctions `presser` et `relacher`). Le clavier, le tactile et plus tard le MIDI traduisent leurs événements en actions ; aucun d'eux n'appelle le jugement directement.
2. **Heure du toucher.** Une action tactile est jugée à l'heure de l'événement (`event.timeStamp`), ramenée sur l'horloge de la chanson (ADR-0004), pas à l'heure où le code la traite.
3. **Zone gauche** : la moitié gauche de l'écran. En haut de la mi-hauteur : sauter ; en bas : glisser. L'action est fixée au contact et ne change pas si le doigt bouge. Le doigt maintenu tient la glissade (tunnels).
4. **Zone droite** : la moitié droite de l'écran, coupée en quatre bandes horizontales dont les limites sont à mi-chemin entre les couloirs de la scène. La bande touchée donne le couloir ; le doigt maintenu tient la note.
5. **Accord à un pouce** : en tactile, toucher l'un des couloirs d'un accord joue toutes les notes de la main droite de cet accord, qui comptent comme réussies, avec le bonus d'accord. Lever le doigt relâche toutes ces notes. Toucher un couloir hors de l'accord reste une erreur. Au clavier, il faut toujours presser toutes les touches de l'accord.
6. **Chaque doigt est indépendant** : plusieurs doigts agissent en même temps (accords à deux mains).
7. **Mode tactile** : le réglage « Commandes » vaut Automatique (tactile sur un écran sans survol au pointeur grossier), Clavier ou Tactile. En mode tactile, la scène occupe tout l'écran, les réglages passent dans un menu, un bouton remplace `Échap`, et le portrait affiche un écran qui demande de tourner le téléphone et met la partie en pause.
8. **Mécaniques à venir** : chaque nouvelle mécanique doit indiquer son geste tactile dans les zones existantes, sans ajouter de reconnaissance de geste qui retarde l'action, ou proposer un nouvel ADR.

## Conséquences

- **Positives** : aucune latence ajoutée, la chanson générée (ADR-0005) et le jeu au clavier ne changent pas, et la couche d'actions sert aussi au MIDI.
- **Négatives** : un accord est plus facile au doigt qu'au clavier, donc les scores tactile et clavier ne se comparent pas tout à fait. Le pouce droit cache un peu les ennemis qui arrivent.
- **À surveiller** : si les accords paraissent trop faciles au doigt, passer à la règle du couloir le plus bas (B2). Si la limite entre sauter et glisser cause des erreurs, ajouter les gestes dans une issue à part.

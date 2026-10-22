# ADR-0006 : Séparer les univers des mécaniques de jeu

- **Statut** : Acceptée
- **Date** : 2026-10-22
- **Issues liées** : aucune

## Contexte

Deux univers ont été retenus : La Ville Muette et La Boîte à musique. Ils doivent partager les mêmes règles de jeu, et on pourrait en ajouter d'autres.

## Options considérées

### Option A : un jeu séparé par univers
Liberté totale, mais chaque correction de gameplay doit être faite deux fois.

### Option B : un thème qui ne touche qu'à l'habillage
Un objet de thème fournit les textes, et des fonctions de dessin et de son propres à chaque univers ; la logique de jeu ne connaît pas l'univers.

## Décision

Option B. Un univers peut changer :

- le décor, le sol, le personnage, l'apparence des obstacles et des ennemis ;
- les timbres des instruments ;
- les textes (nom des lieux ou des souvenirs, barre de vie, couches du combo, messages).

Un univers ne peut pas changer : le rythme, les notes, les fenêtres de jugement, la géométrie de collision, les dégâts. Les couleurs des deux mains (ambre pour la gauche, cyan pour la droite) et des couloirs restent les mêmes partout, pour que la lecture du jeu ne change pas.

## Conséquences

- **Positives** : une mécanique se corrige une seule fois, et ajouter un univers ne demande que de l'habillage.
- **Négatives** : un univers ne peut pas avoir de mécanique propre sans un nouvel ADR.
- **À surveiller** : des conditions `if (S.theme === …)` qui apparaissent dans la logique de jeu signalent une fuite de cette séparation.

# ADR-0003 : Faire jouer des degrés de l'accord, pas des notes fixes

- **Statut** : Acceptée
- **Date** : 2026-10-21
- **Issues liées** : aucune

## Contexte

Le joueur doit produire de la musique agréable même quand il se trompe, et la musique est générée : on ne peut pas écrire une partition par niveau à la main.

## Options considérées

### Option A : chaque touche joue une note fixe
`J` joue toujours un La, `K` toujours un Do, etc. Simple, mais une note fixe sonne faux dès que l'accord change.

### Option B : chaque touche joue un degré de l'accord en cours
La zone donne l'accord, et l'action choisit un degré dans cet accord.

## Décision

Option B, pour les deux mains :

| Main | Action | Degré |
|---|---|---|
| Gauche | Glisser `S` | Fondamentale (grave) |
| Gauche | Sauter `W` | Octave |
| Droite | `J` `K` `L` `;` | Fondamentale, tierce, quinte, octave |

Les accords (plusieurs ennemis au même temps) n'utilisent que ces degrés. Toute nouvelle note jouable (notes de passage, solo) doit rester dans la gamme de la chanson.

## Conséquences

- **Positives** : il est impossible de jouer faux, le générateur reste simple, et la même mélodie se transpose toute seule quand l'accord change.
- **Négatives** : la mélodie est limitée aux notes de l'accord, ce qui peut sonner arpégé et répétitif.
- **À surveiller** : si on ajoute des notes de passage, il faudra un nouvel ADR pour les règles (temps faibles seulement, gamme pentatonique).

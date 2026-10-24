# ADR-0019 : Représenter la musique par des scènes interchangeables, une par lieu

- **Statut** : Acceptée
- **Date** : 2026-10-24
- **Issues liées** : #21 (mains croisées, retirées) ; issues de mise en œuvre à écrire
- **Artefact de décision** : https://claude.ai/artifact/DqAxRXgkbDAFuXhwwUcBFG (maquettes : https://claude.ai/artifact/B3uWfRZ5BjkqKTyvGkpryU)

## Contexte

Les joueurs aiment le gameplay mais pas l'image : quatre couloirs horizontaux, une légende permanente, de petits sprites dans des contours vides, un décor qui ne bat pas au temps. Quatre maquettes ont proposé une autre façon de représenter la musique : de côté en papier découpé, en colonnes qui tombent sur les doigts (d'après un croquis pour téléphone), sur un disque qui tourne, et en perspective vers l'horizon. Elles ont toutes plu : le jeu doit pouvoir représenter la musique de plusieurs façons.

Ce qui était vrai avant cette décision :

- Le jugement travaille en temps, en main et en degré, sur l'horloge audio (ADR-0004) ; il ignore où une note est dessinée. Les univers ne fournissent que l'habillage (ADR-0006, ADR-0015).
- La projection du temps vers l'écran est écrite en ligne : `HITX + (ev.beat - nb) * PPB` revient 45 fois dans `src/rendu/scene.ts`, et encore dans `ville.ts`, `boite.ts` et `outils.ts`. Les couloirs sont des hauteurs fixes, `LANE_Y` (`src/rendu/outils.ts`).
- Les zones tactiles en dépendent : la moitié droite de l'écran est coupée en bandes à mi-chemin entre les couloirs affichés (ADR-0008, règle 4, `src/ui/tactile.ts`). ADR-0008 avait écarté les zones à côté de la scène (option B3) parce qu'elles ne s'alignaient plus sur les couloirs ; sur un disque ou en perspective, il n'y a plus de bandes horizontales à suivre.
- Les mains croisées (#21) retournent la scène pendant un pont (`src/jeu/croisement.ts`) ; le générateur en pose une avant le solo libre une fois sur deux en Difficile (`croiseeP: 0.5`, `src/chanson/difficultes.ts`), et les partitions l'écrivent `croisee: true` (ADR-0016). C'est la seule mécanique liée à la géométrie de côté.
- Les ennemis des neuf lieux sont dessinés autour d'un centre (`DessinEnnemi(x, y, …)`, `src/rendu/outils.ts`).

## Options considérées

### Question 1 : comment brancher plusieurs scènes sur le même jeu ?

- **1A, un contrat de scène** : une scène fournit les poses (position, échelle, angle) des notes et des obstacles, les points d'impact, son sol et son fond ; tout le reste est commun. Une scène nouvelle coûte sa projection et son décor. Il faut d'abord extraire la projection de `scene.ts`.
- **1B, un moteur de rendu par scène** : une copie de `scene.ts` par scène. Rien à extraire, mais chaque mécanique se dessine et se corrige quatre fois.
- **1C, un monde 3D et des caméras** : le disque et les colonnes ne sont pas des caméras, tout le rendu est à refaire, et une bibliothèque embarquée contredirait ADR-0007.

### Question 2 : quand une partie change-t-elle de scène ?

- **2A, par lieu** : chaque lieu de la carte a sa scène, le boss la sienne ; un réglage peut fixer une scène. Jamais de changement en pleine chanson.
- **2B, par section** : la scène change dans la chanson, avec des mesures vides écrites par le générateur. L'effet le plus fort, mais il touche le générateur et fatigue la lecture.
- **2C, au choix du joueur seulement** : le plus simple, mais la plupart des joueurs ne verraient jamais les autres scènes.

### Question 3 : que deviennent les mains croisées ?

- **3A, gardées dans la scène de côté seulement** : coût nul, mais une mécanique qui n'existe que dans une scène sur quatre.
- **3B, retirées** : toutes les mécaniques valent dans toutes les scènes ; les chansons en Difficile changent.
- **3C, un retournement inventé par chaque scène** : quatre lectures à concevoir, et des colonnes à l'envers qui éloignent les notes des doigts.

### Question 4 : comment jouer au doigt dans toutes les scènes ?

- **4A, des zones fixes dessinées dans l'écran** (le croquis) : le même geste partout ; la scène perd environ un cinquième de la largeur et de la hauteur sur téléphone.
- **4B, des zones propres à chaque scène** : on touche la note là où on la voit, mais le geste change d'un lieu à l'autre et les anneaux du disque sont fins sous un pouce.
- **4C, les deux au choix** : le coût de 4A et de 4B réunis.

## Décision

**1A, 2A, 3B, 4A.** Le jeu a plusieurs scènes derrière un contrat commun, une par lieu ; les mains croisées sont retirées ; on joue au doigt avec des zones fixes dessinées dans l'écran.

### Le contrat de scène (1A)

- **Quatre scènes** : `cote` (de côté, la lecture actuelle, habillée en papier découpé), `colonnes` (la mélodie tombe en colonnes sur les doigts, la basse reste de côté), `disque` (le temps est un angle, les degrés des anneaux, de la fondamentale au plus près du centre à l'octave au plus loin) et `horizon` (le temps est de la profondeur, la basse sur la route, la mélodie sur quatre rails dans le ciel). Une scène vit dans `src/rendu/scenes/`.
- **Une scène ne fournit que sa géométrie et son décor** : la pose (position, échelle, angle, visibilité) d'une note de chaque couloir et d'un obstacle de la basse à un temps donné, les points d'impact des couloirs et du personnage, l'avance (combien de temps elle montre à l'avance), son sol et son fond. Elle ne juge rien, ne lit pas l'état du jeu au-delà du temps, et ne décide d'aucune règle.
- **Tout le reste est commun** et se dessine à la pose donnée : ennemis des lieux, personnage, obstacles, tenues, serpents, trilles, relais, petites notes, chanteur, traces des notes parfaites, fantôme, effets du jugement, HUD. Aucun `if` sur la scène dans `jeu/` ni dans `chanson/`.
- **Chaque scène est habillée par chaque univers** (ADR-0015) : les couleurs des mains et des couloirs d'ADR-0006 restent les mêmes, une couleur et une forme par degré (rond, triangle, carré, losange).
- **Toute mécanique vaut dans toutes les scènes.** Une nouvelle mécanique doit pouvoir se dessiner avec les poses du contrat ; si elle exige une géométrie propre, il faut un nouvel ADR.
- **Chaque scène a un essai dans chaque univers**, et la simulation joue une chanson entière dans chaque scène.
- **La première étape ne change aucun pixel** : la scène de côté est extraite derrière le contrat, et les tests existants passent sans modification de l'image.

### Une scène par lieu (2A)

- La scène d'une chanson est celle du lieu de sa progression, la même dans les deux univers : la table lieu → scène est de la logique pure dans `jeu/`, pas un champ d'`Univers`. Le niveau du boss a sa propre scène.
- Une composition et une chanson du répertoire prennent la scène du lieu de leur progression, ou `cote` si elles n'en ont pas.
- Un réglage « Scène », avec sa propre clé (`deux-mains-scene`, ADR-0014), vaut « celle du lieu » par défaut ou fixe une scène pour toutes les chansons.
- Le jugement ne dépend pas de la scène : les meilleurs scores, les traces et les fantômes restent rangés comme aujourd'hui, quelle que soit la scène jouée.
- Une scène ne change jamais en pleine chanson. Le changement par section (2B) demandera un nouvel ADR.

### Les mains croisées retirées (3B)

- Le générateur ne pose plus de pont en mains croisées (`croiseeP` disparaît de `DIFFS`). Les chansons en Difficile changent : augmenter `VERSION_GENERATEUR`, régénérer l'instantané et son empreinte, comme le prévoit `CLAUDE.md`.
- `src/jeu/croisement.ts`, son rendu et l'essai `mains-croisees` sont retirés ; l'éditeur ne propose plus « Mains croisées ».
- Les partitions déjà écrites restent lisibles : `croisee: true` est encore accepté à la lecture d'une partition et d'un code `DMP1`, et la section se joue comme un pont à l'endroit, avec ses notes écrites.

### Les zones tactiles fixes (4A)

Cette partie remplace les règles 3 et 4 d'ADR-0008 ; ses autres règles restent (actions horodatées, heure du toucher, accord à un pouce, doigts indépendants, mode tactile).

- **Zone gauche** : une colonne à gauche de l'écran, environ un cinquième de la largeur, coupée en deux : sauter en haut, glisser en bas. Le doigt maintenu tient la glissade.
- **Zone droite** : une rangée en bas, sous la scène, environ un cinquième de la hauteur, coupée en quatre zones égales, de gauche à droite `couloir0` à `couloir3` (index, majeur, annulaire, auriculaire). Chacune porte la forme et la couleur de son degré, et s'allume quand une note de son couloir approche.
- La scène se dessine dans le rectangle qui reste. Les zones ne dépendent pas de la scène : le même geste joue le même couloir dans tous les lieux.
- Au clavier et au MIDI, les zones ne sont pas dessinées et la scène occupe tout l'écran.

## Conséquences

- **Positives** : les quatre représentations arrivent sans toucher au jugement, chacune livrable seule ; une mécanique se dessine une fois pour toutes les scènes ; la carte devient un voyage où chaque lieu se lit autrement ; le jeu au doigt devient le même dans toutes les scènes et ne cache plus la scène.
- **Négatives** : extraire la projection de `scene.ts` est un travail sans effet visible ; chaque scène demande un décor par univers ; les chansons en Difficile changent et les fantômes de l'ancienne version du générateur partent en premier ; sur téléphone, la scène est plus petite qu'aujourd'hui.
- **À surveiller** : une scène qui se lit mal seule, aux difficultés hautes surtout (elle devrait alors devenir une section, par un nouvel ADR) ; des records nettement plus faciles dans une scène que dans une autre (il faudrait alors séparer les meilleurs scores par scène) ; une mécanique future qui ne se dessine pas avec les poses du contrat.

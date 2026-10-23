# ADR-0010 : Faire écrire les notes hors accord par le générateur, la touche ne choisissant qu'un geste

- **Statut** : Acceptée
- **Date** : 2026-10-22
- **Issues liées** : #13, #14
- **Artefact de décision** : https://claude.ai/artifact/7Cp15CzVv4eDnw9i7MBeLN (question 3)

## Contexte

Deux issues ajoutent des notes qui ne sont pas des degrés de l'accord : une walking bass en Difficile (#13), dont les marches suivent la gamme, et de petites notes de passage à la mélodie en Normal et en Difficile (#14). ADR-0003 l'avait prévu : « Toute nouvelle note jouable (notes de passage, solo) doit rester dans la gamme de la chanson », et « si on ajoute des notes de passage, il faudra un nouvel ADR pour les règles (temps faibles seulement, gamme pentatonique) ». Une seule décision vaut pour les deux mains.

Ce qui était vrai avant cette décision :

- Main droite : quatre couloirs, fondamentale, tierce, quinte et octave (`makeChord`, `lanes`, `src/chanson/theorie.ts`). Main gauche : quatre codes dans `Note.lane`, 0 glisser, 1 sauter, 2 double saut (#7), 3 écraser (#8) (`src/chanson/types.ts`).
- La hauteur d'une note est fixée par le générateur dans `ev.midi`. Le jugement ne regarde que `lane` et `beat` (`findNear`, `leftPress`, `rightPress`), et le son vient de `ev.midi` (`playHit`) : une touche choisit déjà un geste, jamais une hauteur.
- Il n'y avait pas de gamme dans le code : `Progression.mode` vaut « majeur » ou « mineur ». Le Vamp dorien est en dorien ; la cadence andalouse (La m, Sol, Fa, Mi en La) a un accord de Mi majeur avec un Sol♯, hors de La mineur naturel.
- En tactile (ADR-0008), la limite entre deux bandes de droite est à mi-chemin entre deux couloirs, là même où serait un petit ennemi. Zone gauche : en haut sauter, en bas glisser.
- Le mot « passage » est déjà pris : `Note.passage` est le numéro de passage d'une boucle (ADR-0009). Les notes de passage s'appellent ici « petites notes ».
- Toute modification du générateur change les chansons (ADR-0005).

## Options considérées

### Option 3A : le générateur écrit la note, la touche choisit le geste ; une petite note se joue avec l'une ou l'autre touche voisine

Les notes hors accord n'existent que si le générateur les écrit, avec leur hauteur dans `ev.midi`. Le joueur ne peut pas en produire seul : le solo libre reste en degrés. Elles tombent sur les temps faibles et mènent toujours à une note de l'accord. Un petit ennemi entre les couloirs n et n + 1 se touche avec l'une ou l'autre des deux touches ; dans un escalier, sauter monte d'une marche et glisser descend. Avantages : impossible de jouer faux, aucune nouvelle touche, aucune exception tactile, pas de confusion avec un accord de deux couloirs voisins. Inconvénients : indulgent (on réussit une petite note sans viser précisément), et W et S changent de sens dans un escalier, ce qu'il faut rendre lisible. Coût moyen, facile à défaire par difficulté.

### Option 3B : comme 3A, mais la petite note demande les deux touches voisines ensemble

Mêmes règles musicales ; un petit ennemi entre J et K demande J et K dans la même fenêtre. Plus exigeant, mais même geste qu'un accord de deux couloirs voisins (seul le dessin les distingue), dur dès le Normal sur une croche faible, impossible au pouce sans une exception tactile comme ADR-0008, règle 5, et deux touches MIDI pour une seule note.

### Option 3C : couloirs de gamme

La main droite passe à sept couloirs, un par note de la gamme, et le joueur peut jouer toute note de la gamme, solo compris. Le plus expressif, mais une note de gamme sur un temps fort peut frotter avec l'accord (fin de « impossible de jouer faux »), sept bandes tactiles sont trop étroites (ADR-0008 à refaire), et la scène et les deux univers sont à redessiner. Coût très élevé ; remplace ADR-0003.

### Option 3D : ornements joués par le jeu, sans geste

Le séquenceur ajoute seul les marches et les notes de passage, comme l'arpège. Aucune règle de touche ni nouvel ennemi, mais cela ne répond pas aux issues (« les marches se jouent avec W et S », « petits ennemis »), et on entendrait des notes qu'on n'a pas jouées.

## Décision

Option 3A. Le générateur écrit chaque note hors accord, avec sa hauteur ; la touche ne choisit qu'un geste.

Cet ADR **complète ADR-0003 sans la remplacer**. Le principe d'ADR-0003 reste entier : le jeu fixe la hauteur, la touche ne joue jamais une note fixe, on ne peut pas jouer faux, et toute note jouable reste dans la gamme de la chanson, comme ADR-0003 l'exigeait déjà. ADR-0003 demandait elle-même un nouvel ADR pour fixer les règles des notes de passage ; c'est celui-ci. Son tableau des gestes s'enrichit (comme il l'a fait pour le double saut et l'écrasement) sans changer pour les notes existantes.

Règles :

- **Origine** : une note hors accord n'existe que si le générateur l'écrit (`ev.midi`). Le joueur n'en produit jamais seul, y compris au solo libre, qui reste en degrés de l'accord.
- **Gammes** (`gammeDe`, `src/chanson/theorie.ts`) : la basse prend la gamme de la tonalité (majeur, mineur naturel, ou dorien pour le Vamp dorien, `Progression.gamme`), la mélodie la pentatonique prise dans cette gamme (sans les 4ᵉ et 7ᵉ degrés en majeur, sans les 2ᵉ et 6ᵉ en mineur et en dorien). Une note de l'accord en cours hors de la gamme remplace la note qu'elle contredit, à un demi-ton : celle du dessous (un degré haussé : Sol devient Sol♯ sur le Mi majeur de la cadence andalouse en La mineur), sinon celle du dessus.
- **Petites notes** (#14), en Normal et en Difficile (`petitesP`) :
  - elles tombent sur la croche faible libre qui précède une note de la mélodie sur le temps, dans la même mesure ; cette note d'arrivée est un degré de l'accord, jamais une trille ni un serpent ;
  - la note d'avant est une note simple : pas de note tenue, de trille, de serpent ni d'accord de la main droite. Une petite note n'est jamais jouée en même temps qu'une autre note de la main droite ;
  - un petit ennemi se place entre le couloir de la note d'arrivée et son voisin du côté de la note d'avant (`lane` = n + 0,5) ; après la même note, il vient d'en dessous (d'au-dessus pour la fondamentale) ;
  - il joue la note de la pentatonique entre les degrés de ses deux couloirs, la plus proche de la note d'arrivée ; sans note de la pentatonique entre les deux, pas de petite note ;
  - il se touche avec l'une ou l'autre des deux touches voisines (clavier, MIDI en position fixe), ou l'une ou l'autre des deux bandes en tactile. Toute autre touche est un mauvais couloir ;
  - les phrases du solo reprises au dernier refrain (ADR-0012) n'en ont pas.
- **Escaliers de walking bass** (#13), en Difficile seulement (`escalierP`) :
  - au couplet et au refrain, hors mesure de la plaque (#8) et hors dernière mesure de la section ;
  - la basse part de la fondamentale (glisser) ou de l'octave (sauter) de l'accord, puis joue une marche par temps jusqu'au bout de la mesure, par degrés voisins de la gamme, et arrive au premier temps suivant sur la fondamentale de l'accord suivant (la note que joue déjà le début de la mesure suivante) ;
  - trois marches depuis le premier temps, deux depuis le deuxième, une depuis le troisième, selon le nombre de notes de la gamme entre le départ et l'arrivée ; au-delà de trois, ou sans note entre les deux, pas d'escalier ;
  - sur les temps forts (1 et 3), la note est une note de l'accord ; les notes hors accord ne tombent que sur les temps 2 et 4 ;
  - un escalier ne remplace que des notes simples (glisser, sauter) et des silences : tunnels, pentes, doubles sauts et plaques restent ;
  - deux nouveaux codes de main gauche : `lane` 4 (monter une marche), joué avec sauter (`W`, haut de la zone tactile), et `lane` 5 (descendre une marche), joué avec glisser (`S`, bas de la zone tactile). Le mauvais geste rate la marche.
- **Graine** (ADR-0005) : les petites notes et les escaliers se tirent chacun avec leur propre suite de nombres dérivée de la graine, comme les serpents (#16) : Débutant et Facile gardent exactement leurs chansons.
- **Lisibilité** : le petit ennemi est plus petit que les autres, entre deux couloirs, dans un halo aux couleurs de ses deux couloirs, avec ses deux touches ; une marche est un bloc dont la hauteur suit sa note, avec `W ↑` ou `S ↓`, et le rail de gauche annonce « MONTER ↑ » ou « DESCENDRE ↓ ».

## Conséquences

- **Positives** : la mélodie et la basse sortent des seuls degrés de l'accord sans casser la promesse d'ADR-0003 ni la règle tactile d'ADR-0008 ; aucune nouvelle touche ; l'auto-play, le mode une main, le duo et le MIDI jouent ces notes comme les autres.
- **Négatives** : la petite note est indulgente ; dans un escalier, `W` et `S` changent de sens ; les chansons Normal et Difficile changent (instantané régénéré). Les progressions qui avancent d'un degré à chaque accord (cadence andalouse, Royal Road) ont peu ou pas d'escaliers.
- **À surveiller** : si les essais montrent que les petites notes sont trop faciles pour compter, passer à 3B en Difficile seulement ; si les joueurs confondent sauter-monter et sauter-octave, renforcer le dessin de l'escalier ; si le mode pianiste (ADR-0011) arrive, la touche blanche entre deux couloirs (Ré, Fa, La) pourra jouer la petite note.

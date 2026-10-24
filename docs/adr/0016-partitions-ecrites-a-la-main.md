# ADR-0016 : Écrire les chansons à la main en partitions de motifs par mesure, compilées en chanson

- **Statut** : Acceptée (les accords imposés par la progression et les petites notes pentatoniques sont remplacés par [ADR-0018](0018-accords-ecrits-et-repertoire-de-chansons-connues.md))
- **Date** : 2026-10-23
- **Issues liées** : #28
- **Artefact de décision** : https://claude.ai/artifact/DHPaMew5QGbfRt9tyNHYcB (question 4)

Complète [ADR-0005](0005-chansons-generees-par-graine.md) sans la remplacer : une chanson vient toujours d'une graine, ou désormais d'une partition.

## Contexte

L'issue #28 fait composer sa propre chanson dans un éditeur : une grille dont les lignes sont les gestes (les quatre couloirs de la mélodie, sauter, glisser) et les colonnes les croches d'une mesure, avec une progression, une tonalité et un tempo. La composition doit se jouer avec les règles habituelles, se sauvegarder, et se partager par un code qui la recrée à l'identique. ADR-0005 dit qu'une chanson vient d'une graine. Le format choisi servira plus tard à des niveaux écrits à la main.

Ce qui était vrai avant cette décision :

- Une chanson est une structure de données ordinaire (`Chanson`, `src/chanson/types.ts`). Une `Note` mêle des champs de partition (`beat`, `lane`, `midi`, `trille`, `serpent`) et des champs d'état de partie (`state`, `voice`, `ecart`, `troncon`…).
- Les essais écrivaient déjà des mesures à la main : `assembler()` (`src/essais/fabrique.ts`) réécrit basse et mélodie à partir de motifs texte d'une mesure, dans la notation de `DIFFS` (« S...W... », « 0.1.2-.. »), puis `finaliser()` trie, relie les accords et calcule les sauts comme le générateur.
- Les fonctions de notes du générateur (`notesDeBasse`, `noteDeMelodie`, `petiteNote`) prennent un accord et donnent des degrés (ADR-0003).
- La graine sert aussi au hasard de l'auto-play au solo (`improviser(S.song.seed, …)`, ADR-0012).
- Les positions sont des multiples de 1/12 de temps ; un motif de 8 signes joue des croches, un motif de 12 des triolets (ADR-0013).
- La sauvegarde est un document versionné, avec un code `DM<v>.…` ; le préfixe `DMP` était réservé aux partitions (ADR-0014).

## Options considérées

### Option 4A : la chanson complète, sérialisée

On enregistre la `Chanson` telle quelle, notes comprises, sans les champs d'état. Recrée exactement ce qui a été joué, sans traduction ; mais lie le format de sauvegarde aux détails internes de `Note`, donne des codes de plusieurs Ko et permet des hauteurs hors gamme (contraire à ADR-0003). Facile à faire, difficile à défaire une fois des codes partagés.

### Option 4B : une partition en motifs par mesure, compilée en chanson (retenue)

Une partition dit l'intention : tonalité, tempo, progression, difficulté, puis des sections avec un motif de basse et un motif de mélodie par mesure, dans la notation des essais. Une fonction pure la compile en `Chanson` avec les fonctions de notes du générateur. Codes courts et lisibles, notes toujours dans la gamme, toutes les mécaniques notées disponibles, et la grille de l'éditeur est la notation. En contrepartie, la notation devient un format public à garder compatible.

### Option 4C : une graine et des retouches

Une composition part d'une chanson générée et liste les notes ajoutées ou retirées. Codes très courts pour une petite variation ; mais chaque régénération de l'instantané (ADR-0005) change la base et casse les compositions, et l'éditeur part d'un cylindre vide.

### Option 4D : la grille brute de picots

Chaque mesure est une grille de six lignes et huit colonnes, un bit par picot. Le code le plus court ; mais seulement des notes simples (ni tenue, ni trille, ni serpent, ni triolets), inutilisable pour des niveaux plus riches.

## Décision

**Option 4B.** Une chanson écrite à la main est une partition en motifs par mesure, compilée par `composer()` ; la chanson garde sa source, une graine ou l'empreinte de sa partition.

### Le format de la partition

`src/chanson/partition.ts` (logique pure, règle ESLint des modules purs, couverture d'au moins 90 %) :

```json
{
  "v": 1,
  "titre": "Valse du grenier",
  "ton": 9,
  "bpm": 96,
  "diff": "facile",
  "prog": "Cadence andalouse",
  "sections": [
    { "genre": "intro", "mesures": 1, "basse": ["S......."], "melodie": ["........"] },
    { "genre": "couplet", "mesures": 4, "basse": ["S...W...", "T---W..."], "melodie": ["0.1.2...", "2-----.."] },
    { "genre": "pont", "mesures": 2, "basse": ["T------."], "melodie": [] }
  ]
}
```

- `v` : la version de la notation (`VERSION_PARTITION`, 1). Un nouveau signe ou un nouveau champ l'augmente ; un jeu plus ancien refuse alors la partition en disant pourquoi.
- `titre` : 40 caractères au plus, éventuellement vide. Il est toujours échappé avant d'être écrit dans une page.
- `ton` : la tonique, de 0 (Do) à 11 ; `bpm` : de 60 à 180 ; `diff` : une clé de `DIFFS` (fenêtres de jugement et dégâts) ; `prog` : le nom d'une progression de `PROGS`.
- `sections` : de 1 à 16, 64 mesures en tout au plus. Chacune a un `genre` (`intro`, `couplet`, `refrain`, `pont`, `polyrythmie`, `outro`), de 1 à 32 `mesures`, et `croisee: true` pour un pont en mains croisées. Les accords suivent la progression depuis la première mesure de la section, et l'outro prend l'accord de fin, comme dans le générateur.
- `basse` et `melodie` : un motif par mesure, repris en boucle s'il y en a moins que de mesures ; une liste vide fait taire la main.

### Ce qui est permis dans un motif

Un motif a **8 signes** (croches) ou **12 signes** (triolets), indépendamment pour chaque main (ADR-0013) ; chaque position se calcule en pas de la grille de 12 par temps.

- Basse : `S` glisser, `W` sauter, `D` double saut, `P` plaque à écraser, `T` tunnel, `M` pente montante et `B` pente descendante (tenus sur les `-`), `.` silence.
- Mélodie : `0` à `3` le couloir, `-` prolonge la note, `~` et `_` en trille avec le couloir au-dessus ou au-dessous, `/` et `\` en serpent, `a` `b` `c` une petite note entre deux couloirs, `.` silence.

### Ce qui est interdit

- Toute hauteur écrite : les notes sont des degrés de l'accord (ADR-0003, ADR-0010). Les marches d'escalier (`/` et `\` dans la basse), dont la hauteur sort de la gamme du générateur, ne s'écrivent pas.
- Une mélodie dans un solo libre (`pont` sans `croisee`) : elle est à celui qui joue.
- Les chanteurs, les relais et les accords de la main droite : la notation n'écrit qu'une note par signe et par main.
- Une partition qui enfreint une seule règle est refusée par `lirePartition()`, pas réparée : un code partagé recrée la chanson à l'identique, ou rien.

### `composer()` et la source de la chanson

- `composer(partition)` est pure. Elle écrit la basse avec `notesDeBasse` et la mélodie avec `notesDeMelodie` (sortie de la fabrique des essais pour `chanson/`), puis `finaliser()`. Elle n'ajoute aucune plaque d'office : une partition écrit la sienne (`P`). La fabrique des essais utilise les mêmes fonctions pour ses mesures réécrites ; les chansons des essais n'ont pas changé.
- `Chanson.source` dit d'où vient une chanson : `{ genre: "graine", graine, diff }` (posée par `buildSong`, hors de l'instantané) ou `{ genre: "partition", empreinte, titre }`. Une chanson d'essai réassemblée n'en a pas.
- L'empreinte est un hachage (cyrb53, 14 chiffres hexadécimaux) du texte normalisé de la partition (`normaliser()` : champs dans un ordre fixe, rien d'autre). La graine de la chanson composée en est tirée (`graineDe`), pour le hasard de l'auto-play au solo. La chanson composée ne dépend ni des champs internes de `Note`, ni de `VERSION_GENERATEUR`.
- Un instantané des partitions (`tests/instantanes/partitions.json`) protège la notation : changer une fonction de notes partagée qui change une partition doit être voulu.

### Sauvegarde et partage

- Le document de sauvegarde passe à la version 2 (`VERSION`, migration `1 → 2`) : un champ facultatif `compositions`, les partitions par empreinte, absent tant qu'il n'y en a pas. `reparer` relit chaque partition avec `lirePartition` et la range sous son empreinte recalculée ; `fusionner` additionne les compositions. Une sauvegarde en garde au plus 24.
- Le meilleur score d'une composition est rangé sous `p:<empreinte>` (`clePartition`), jamais sous une clé de graine. Une composition ne réussit pas de lieu sur la carte du monde : la carte se gagne avec les chansons du jeu.
- Le code de partage est `DMP<v>.` suivi du JSON normalisé en base64url, le même encodage que le code de sauvegarde (`encoderPartition`, `decoderPartition`, `src/sauvegarde/code.ts`).

### L'éditeur

Une mécanique commune aux deux univers (ADR-0006, ADR-0015) : la Boîte l'habille en cylindre à perforer, la Ville en console de la radio pirate. Ses opérations sur une partition sont pures (`src/jeu/editeur.ts`) ; une composition s'installe comme un essai, en imposant sa difficulté sans l'enregistrer.

## Conséquences

- **Positives** : des codes courts et lisibles, qu'on peut écrire à la main pour des niveaux ; des notes toujours dans la gamme ; boucles, reprise du solo et auto-play marchent sans changement puisqu'on obtient une `Chanson` ; le générateur et son instantané ne changent pas.
- **Négatives** : la notation est un format public, dont chaque nouveau signe doit rester compatible (version `v`) ; une petite partie du générateur (`notesDeBasse`, `noteDeMelodie`, `petiteNote`) est partagée avec les partitions ; une composition ne peut pas écrire d'accord de la main droite.
- **À surveiller** : si des niveaux écrits à la main demandent des accords de la main droite, des chanteurs ou des escaliers, il faudra une version 2 de la notation ; si une fonction de notes partagée doit changer, l'instantané des partitions le signalera, et les meilleurs scores `p:` en dépendent.

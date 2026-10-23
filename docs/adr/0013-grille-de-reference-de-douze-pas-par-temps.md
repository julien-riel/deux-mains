# ADR-0013 : Garder le temps en nombre, sur une grille de référence de douze pas par temps

- **Statut** : Acceptée
- **Date** : 2026-10-23
- **Issues liées** : #19
- **Artefact de décision** : https://claude.ai/artifact/DHPaMew5QGbfRt9tyNHYcB (question 1)

## Contexte

L'issue #19 ajoute, en Difficile, une section en polyrythmie 3 contre 2 : la basse joue trois notes par temps (triolets) pendant que la mélodie en joue deux (croches). L'issue le signalait elle-même : le générateur travaille en croches, et passer à une grille plus fine est un changement de structure. Le choix touche le générateur, le séquenceur, l'auto-play, l'instantané des chansons et tout futur rythme (swing, 4 contre 3, partitions écrites à la main).

Ce qui était vrai avant cette décision :

- La note porte déjà son temps en nombre : `Note.beat` vaut `bar * 4 + k / 2` (`notesDeBasse`, `src/chanson/generateur.ts`). La grille de croches n'existe que dans l'écriture : motifs de basse de 8 signes par mesure (`DIFFS`), motifs de mélodie de 16 croches (`genMotif`).
- Le jugement ne connaît pas la grille : `findNear` (`src/jeu/jugement.ts`) compare des secondes (`ns - ev.beat * spb()`). Une note à 1/3 de temps s'y juge déjà correctement.
- Les boucles non plus (ADR-0009) : un passage est une copie décalée de k·L temps, avec L entier.
- Le séquenceur avance en double-croches, 16 pas par mesure (`schedule`, `src/audio/sequenceur.ts`). La batterie et l'arpège testent `s % 2`, `s % 4`.
- L'auto-play faisait sonner une note à l'heure du pas, pas à l'heure de la note : `autoNotes(step)` prend les notes de `[step/4, step/4 + 0,25)` et le séquenceur appelait `playHit(ev, t)` avec l'heure du pas. Un triolet serait parti jusqu'à 1/6 de temps trop tôt, soit 100 ms à 100 BPM, le double de la fenêtre « Parfait » de Difficile (45 ms).
- Des égalités exactes regroupaient les accords (`ev[j].beat === ev[i].beat`, dans le générateur, `finaliser` et `reprendre`) et retrouvaient les notes du chanteur (`n.beat === bar * 4 + s / 4`, dans le séquenceur). En croches, ces temps sont des nombres exacts en binaire ; 1/3 ne l'est pas.
- Le solo est recalé sur la croche (ADR-0012 : `noter`, `src/jeu/variations.ts`). La mélodie restant en croches, la reprise du solo n'est pas touchée.
- L'instantané (`tests/support/instantane.ts`) hache `e.beat` tel quel. Tant que `beat` reste un nombre en temps, les chansons sans triolets gardent leur empreinte.
- Le genre `"pont"` désigne le solo libre ; depuis #21, un pont peut aussi être `croisee: true`, et `estSolo()` (`src/jeu/variations.ts`) les distingue.

## Options considérées

### Option 1A : positions libres en temps, sans règle

On garde `beat` tel quel, le générateur écrit les triolets à `k / 3`, et l'auto-play fait sonner chaque note à son heure exacte. Aucune grille n'est déclarée. Le moins de code, et les chansons sans triolets gardent leur empreinte ; mais les égalités `===` sur des tiers peuvent échouer selon le chemin de calcul (`bar * 4 + 1/3` contre `(bar * 12 + 1) / 3`) : un accord non relié, une note de chanteur introuvable, sans erreur visible. Aucune règle pour la suite.

### Option 1B : le temps reste un nombre, sur une grille de référence de 12 pas par temps

Comme 1A, `Note.beat` reste un nombre en temps et le jugement ne change pas. Mais une règle est écrite : toute position et toute durée est un multiple de 1/12 de temps (12 couvre les croches, les double-croches et les triolets). Un petit module pur, `chanson/temps.ts`, donne `pas(beat)`, l'entier correspondant ; toute comparaison, tout regroupement et tout index passe par lui. Les motifs gagnent une forme en triolets : la longueur du motif donne sa division. Le séquenceur garde ses 16 pas, et l'auto-play fait sonner chaque note à son heure. Les chansons de Débutant, Facile et Normal gardent leur empreinte ; la règle n'est pas imposée par le type, et un 5 contre 4 n'y tiendrait pas.

### Option 1C : une grille entière de 12 pas par temps partout

La note porte un entier `pas` (48 par mesure) au lieu d'un temps ; `beat` en devient une dérivée. Le séquenceur passe à 48 pas par mesure, et tout ce qui teste `s % 2` ou `step / 4` est réécrit. Le type impose la grille et l'auto-play tombe juste sans changer de principe ; mais cela touche presque tous les modules, les 80 empreintes changent si l'instantané n'est pas converti, et le séquenceur se réveille trois fois plus souvent pour rien.

### Option 1D : des fractions exactes

Une position est un temps entier plus une fraction (`{ temps, num, den }`). Toutes les polyrythmies sont possibles, sans arrondi ; mais chaque calcul de temps devient une fonction, bien au-delà de l'issue, qui exclut les autres polyrythmies.

## Décision

Option 1B. Le temps reste un nombre en temps, sur une grille de référence de 12 pas par temps, et l'auto-play fait sonner chaque note à son heure. Règles concrètes :

1. **La grille.** Toute position (`Note.beat`, `NoteChantee.beat`) et toute durée (`Note.dur`) de note écrite par le générateur ou la fabrique des essais est un multiple de 1/12 de temps. Un test le vérifie sur toutes les chansons de l'instantané (`surLaGrille`, `tests/polyrythmie.test.ts`).
2. **`pas()`.** `src/chanson/temps.ts` (logique pure) donne `PAS_PAR_TEMPS = 12`, `pas(beat)` (l'entier arrondi), `enTemps(pas)`, `memeTemps(a, b)`, `surLaGrille`, `surLaCroche` et `relierAccords`. Toute comparaison d'égalité, tout regroupement et tout index de temps passe par `pas()` ou `memeTemps()`, jamais par `===` sur `beat` : les accords (générateur, `finaliser`, `reprendre`, `accorder`), le chanteur dans le séquenceur, les notes que prend l'auto-play à chaque pas. Les comparaisons d'ordre (`<`, tri) restent sur les nombres.
3. **Écrire une position hors des croches.** Une position qui n'est pas une croche s'écrit à partir d'un nombre entier de pas, par `enTemps()`, pour que tous les chemins de calcul donnent le même nombre. Les positions en croches (`bar * 4 + k / 2`) restent exactes et inchangées.
4. **Les motifs.** La longueur d'un motif de basse donne sa division de la mesure : 8 signes pour des croches, 12 pour des triolets (`notesDeBasse`, motifs de `DIFFS` et de la fabrique). Une autre longueur qui ne divise pas 48 pas est refusée. La mélodie garde ses motifs en croches.
5. **Les recalages existants ne changent pas.** La reprise du solo (ADR-0012) recale toujours le solo sur la croche (`noter`) ; les boucles (ADR-0009) décalent toujours d'un nombre entier de temps ; le jugement compare toujours des secondes ; les trilles et les serpents restent sur les double-croches du séquenceur.
6. **L'heure de l'auto-play.** Le séquenceur garde ses 16 pas par mesure pour la batterie et l'accompagnement. L'auto-play prend à chaque pas les notes dont le pas tombe entre ce pas du séquenceur et le suivant, et les fait sonner à `timeOfBeat(ev.beat)`, pas à l'heure du pas.
7. **La section en 3 contre 2.** C'est un nouveau genre de section, `"polyrythmie"`, et non un pont : `"pont"` reste le solo libre (ou le pont en mains croisées), `estSolo()` ne change pas. En Difficile seulement, elle vient entre le dernier refrain et l'outro, et sa présence comme sa mélodie se tirent d'une suite de nombres séparée, dérivée de la graine (ADR-0005) : sans elle, la chanson ne change pas, avec elle, elle ne fait que s'allonger de ses quatre mesures.

## Conséquences

- **Positives** : les chansons de Débutant, Facile et Normal gardent exactement leur empreinte, et celles de Difficile ne changent que par la nouvelle section. Les égalités de temps deviennent sûres, et un test garde la règle. La grille couvre aussi les double-croches et les triolets de double-croche : de quoi écrire du swing ou une partition à la main plus tard. Boucles, réécoute et reprise du solo sont inchangées.
- **Négatives** : une règle à respecter partout sans que le type l'impose (`beat` reste un `number`). Un 4 contre 3 tiendrait sur la grille, un 5 contre 4 non. L'instantané régénéré fait passer `VERSION_GENERATEUR` à 2 (ADR-0014) : ce que la sauvegarde rangeait sur les chansons de la version 1 (meilleurs scores, tags, fantômes) est ignoré, dans toutes les difficultés, même celles dont les chansons n'ont pas changé.
- **À surveiller** : des bogues d'arrondi malgré `pas()`, ou l'envie d'une polyrythmie hors de la grille de 12 (5 contre 4) : on passerait alors à une grille entière imposée par le type (option 1C). Indépendamment de l'option, à 112 BPM deux triolets voisins sont à 179 ms, moins que deux fenêtres « Bien » de Difficile (2 × 105 ms) : `findNear` prend la note la plus proche, et l'essai `polyrythmie` le vérifie au clavier.

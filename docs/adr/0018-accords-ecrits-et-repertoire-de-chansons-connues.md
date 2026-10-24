# ADR-0018 : Écrire les accords des partitions pour jouer des chansons connues, rangées dans un répertoire

- **Statut** : Acceptée
- **Date** : 2026-10-24
- **Issues liées** : aucune (demande directe : « Encore plus de chansons ! Il y a des connues mais libres de droits ? Utilise-les ! »)
- **Artefact de décision** : https://claude.ai/artifact/Dfq5ubgmxhgNqDzxXbEqnT

Remplace deux points d'[ADR-0016](0016-partitions-ecrites-a-la-main.md) (les accords imposés par la progression, les petites notes prises dans la pentatonique) ; le reste d'ADR-0016 reste en vigueur. Complète [ADR-0003](0003-couloirs-en-degres-de-l-accord.md) et [ADR-0010](0010-notes-hors-accord-ecrites-par-le-generateur.md) sans les remplacer.

## Contexte

On veut jouer des chansons connues du domaine public (Au clair de la lune, Frère Jacques, l'Ode à la joie…). Les airs sont libres ; les arrangements sont les nôtres. Les partitions écrites à la main (ADR-0016) devraient suffire, mais elles ne savaient pas porter une mélodie reconnaissable :

- les couloirs jouent la fondamentale, la tierce, la quinte et l'octave de l'accord (ADR-0003, `makeChord`, `src/chanson/theorie.ts`) ;
- les accords d'une partition suivaient sa progression en boucle (`composer`, `src/chanson/partition.ts`) : impossible de dire « cette mesure est en Sol7 » ;
- une petite note (`a` `b` `c`) prenait une note de la pentatonique entre deux couloirs (ADR-0010) : en Do majeur, rien entre Mi et Sol, donc pas de Fa. La première mesure de l'Ode à la joie, « Mi Mi Fa Sol », ne s'écrivait pas ;
- une mesure a toujours quatre temps (ADR-0013) : le 2/4, le 4/4 et le 6/8 s'écrivent, le 3/4 non.

## Options considérées

### Option A : arranger avec ce qui existe

Des partitions v1 « dans l'esprit » des chansons, sur une progression existante. Rien à changer, mais peu reconnaissable : sans les bons accords ni les notes de passage, on entend un rythme familier, pas la chanson.

### Option B : accords écrits par mesure, petites notes dans la gamme entière (retenue)

Notation v2 : une section peut écrire ses accords, un par mesure ; dans une partition v2, les petites notes prennent la gamme entière. La mélodie reste écrite en couloirs, sans hauteur écrite. La grille de l'éditeur reste la notation, et les partitions v1 se compilent comme avant.

### Option C : mélodie écrite en hauteurs, couloirs calculés

La mélodie s'écrit en degrés de la gamme, et `composer()` en déduit les couloirs. Le plus simple à recopier depuis une partition papier, mais une deuxième notation que la grille de l'éditeur ne montre pas, et la même tessiture que B (les quatre couloirs d'un accord) : peu de fidélité gagnée pour un coût plus grand. Contredit le cœur d'ADR-0016.

Pour l'endroit où vivent les chansons connues, trois options : un répertoire à part (retenu), des chansons à débloquer sur la carte (touche la carte et l'enchaînement des lieux), ou des modèles dans l'éditeur (caché).

## Décision

**Option B, et un répertoire.**

### La notation v2

`VERSION_PARTITION` passe à 2 (`src/chanson/partition.ts`).

- Une section peut porter `accords` : de 1 à 32 accords, un par mesure, repris en boucle s'il y en a moins que de mesures, comme les motifs. Sans `accords`, la section suit la progression depuis sa première mesure, et l'outro prend l'accord de fin, comme avant.
- Un accord s'écrit en chiffres romains, relatif à la tonique de la partition (`ton`), pour qu'il se transpose avec elle (`lireAccord`) : `I` à `VII` (Do, Ré, Mi, Fa, Sol, La, Si en Do), en majuscules pour un accord majeur et en minuscules pour un accord mineur, suivi de `7` (septième de dominante en majuscules, mineur septième en minuscules) ou de `M7` (septième majeure, en majuscules seulement), précédé de `b` ou `#` pour un degré abaissé ou haussé. Exemples : `I`, `V7`, `vi`, `ii7`, `IVM7`, `bVII`, `bIII`. Les qualités sont celles de `QUAL` ; pas d'accord diminué ni augmenté.
- Les couloirs restent la fondamentale, la tierce, la quinte et l'octave de l'accord écrit (ADR-0003). Leur tessiture est celle de `makeChord` : de la fondamentale (dans l'octave du Do central) à son octave. C'est à l'arrangement de choisir l'accord et la tonalité pour que la mélodie y tienne.
- Dans une partition v2, une petite note prend la note de la **gamme entière** (`gammeDe(…, false)`, avec ses corrections pour les notes de l'accord hors gamme) entre les degrés de ses deux couloirs, la plus proche de la note suivante de la mesure, comme le veut ADR-0010. Une partition v1 garde la pentatonique : elle donne toujours la même chanson.
- `accords` n'est permis qu'en version 2 ; un accord qui ne s'écrit pas fait refuser la partition (`lirePartition`), comme toute autre faute.
- `normaliser` ne met `accords` que si la section en a : l'empreinte d'une partition v1 ne change pas.
- La mélodie ne contient toujours aucune hauteur écrite : la touche choisit un geste, le jeu fixe la note, toujours dans la gamme (ADR-0003, ADR-0010).
- L'éditeur écrit en version 2 (`partitionNeuve`). Il n'écrit pas encore d'accords : une composition qui en a les garde, et ses opérations les reprennent en boucle comme les motifs.

### Le répertoire

- `src/chanson/repertoire.ts` (logique pure, couverture d'au moins 90 %) : `REPERTOIRE`, des airs (`id`, `origine`, `partition`), du plus simple au plus vif. Chaque partition est une partition v2 ; sa `prog` choisit le lieu de la chanson, donc son ennemi, son instrument et son décor (ADR-0015).
- Une chanson du répertoire se joue dans la difficulté du joueur, qui ne règle que le jugement : ses notes sont toujours celles de la partition (`partitionDe(air, diff)`, `composerAir`). Son meilleur score, ses traces et son fantôme sont rangés comme ceux d'une composition, sous `p:<empreinte>` de la partition dans cette difficulté : un score par difficulté. Elle ne réussit pas de lieu. Le format de la sauvegarde ne change pas.
- La chanson porte sa source `{ genre: "partition", empreinte, titre, repertoire: id }`.
- L'écran du répertoire s'ouvre depuis l'écran de départ (touche `M`, hors essai) ; un chiffre lance la chanson de ce numéro. Une chanson du répertoire s'ouvre dans l'éditeur (`P`), où elle devient un brouillon. La Ville l'habille en disques de la radio pirate, la Boîte en airs de la boîte (`TH().repertoire`).
- Un test vérifie, pour chaque air, les notes que la mélodie fait entendre, et que l'auto-play la joue sans faute ; l'instantané des partitions protège chaque air.
- Un air n'entre au répertoire que s'il est du domaine public : un auteur mort depuis plus de soixante-dix ans, ou un air traditionnel. L'arrangement est écrit pour le jeu.

## Conséquences

- **Positives** : des chansons reconnaissables, avec leurs vrais accords et leurs notes de passage, sans hauteur écrite ; les compositions v1 et leurs scores ne changent pas ; une composition peut désormais changer d'accord librement ; le répertoire se remplit en écrivant des partitions, sans toucher au générateur.
- **Négatives** : un accord par mesure seulement ; la tessiture des couloirs oblige parfois à changer une note d'octave ; deux notes de la gamme entre la quinte et l'octave, dont une seule est atteignable selon la note suivante ; pas de 3/4 ni de note chromatique hors accord (le Ré♯ de The Entertainer). Les petites notes des nouvelles compositions de l'éditeur sonnent différemment (gamme entière).
- **À surveiller** : si des airs demandent deux accords par mesure, un accord diminué ou le 3/4, il faudra une version 3 de la notation ; si les joueurs veulent écrire les accords dans l'éditeur, ajouter un sélecteur par mesure (la notation le permet déjà).

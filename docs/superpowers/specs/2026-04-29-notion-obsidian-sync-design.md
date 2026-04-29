# Notion ↔ Obsidian Sync Bidirectionnel — Design Spec

## Contexte

Synchronisation bidirectionnelle entre un système PARA dans Notion (4 bases de données interconnectées) et un vault Obsidian. La dernière modification a priorité. Les éléments nouveaux d'un côté sont créés de l'autre.

## Bases de données Notion

| Base | ID Notion | Rôle |
|---|---|---|
| Areas | `deb9c92e8cb24f5cb1c24fbf61287e43` | Domaines de vie (Culture, Work, Santé, etc.) |
| Projets | `1a423b80d7344b2b8baafa274e86283b` | Projets actifs (SelfFeed, Business Pro, etc.) |
| Tâches | `31b68381b1d5465eb944ce92b670bd69` | Tâches avec statut |
| Ressources | `d16dcb03940f4732a4e377362328f1e7` | Ressources typées (Recettes, Books, Tools, etc.) |

### Schéma des propriétés

**Areas** : Nom, Projets (relation), Tâche (relation), Date, Ressources (relation)

**Projets** : Nom, Sélection (select: Doing/…), Deadline, Date de création, Dernière modification, Areas (relation), Ressources (relation), Tâche (relation)

**Tâches** : Nom, Status (select: To Do / En cours / Done / Backlog / Canceled)

**Ressources** : Nom, URL, Fichiers et médias, Type (select), Tags (multi-select), Projets (relation), Areas (relation), Tâche (relation), Ressources liée (relation self), Dernière modification, Auteur, Commencé, Fiction ?, Genres (multi-select), Lecture (select), Notes, Rating, Terminé

## Décisions techniques

- **Langage** : TypeScript / Node.js
- **Mode de sync** : Commande manuelle (`npm run sync`)
- **Contenu** : Sync complet (body markdown + frontmatter YAML)
- **Conflits** : Dernière modification gagne
- **Approche** : Frontmatter YAML (notion_id) + state file JSON (sync-state.json)
- **Vault Obsidian** : chemin configurable via config.yaml

## Structure des dossiers Obsidian

```
Vault/
├── Areas/
│   ├── Culture.md
│   ├── Work.md
│   └── ...
├── Projets/
│   ├── SelfFeed.md
│   └── ...
├── Ressources/
│   ├── Recettes/
│   ├── Books/
│   ├── Notes de livre/
│   ├── Business Ideas/
│   ├── Outils/
│   ├── Articles/
│   ├── Notes de formation/
│   ├── Films/
│   └── Autres/
├── Tâches/
│   └── ...
└── Archives/
```

### Mapping Type → Sous-dossier (auto-découvert)

Le sous-dossier est automatiquement déduit du champ `Type` de la ressource. Le nom du sous-dossier = valeur du type, pluralisé si pertinent. Aucune configuration manuelle nécessaire.

Exemples :
- Type `Recette` → `Ressources/Recettes/`
- Type `Book` → `Ressources/Books/`
- Type `Business Idea` → `Ressources/Business Ideas/`
- Type `Tool` → `Ressources/Outils/`

Dans l'autre sens (Obsidian → Notion), le type est déduit du sous-dossier parent (ex: fichier dans `Ressources/Recettes/` → type `Recette`).

Si type non défini ou dossier inconnu → dossier racine `Ressources/`.

Toutes les tâches restent dans `Tâches/` (pas de sous-dossiers par statut).

## Gestion des relations

### Stockage dans Obsidian

Les relations sont stockées comme des arrays de Wikilinks dans le frontmatter :

```yaml
---
notion_id: "abc123"
database: ressources
type: Recette
projets:
  - "[[SelfFeed]]"
areas:
  - "[[Saas]]"
taches:
  - "[[Optimiser rss resolver api]]"
ressources_liees:
  - "[[Influence et manipulation - La psychologie de la persuasion]]"
---
```

### Mapping bidirectionnel

Le `sync-state.json` maintient un index `notion_id → {title, database, obsidianPath}`.

**Notion → Obsidian** :
1. Fetch toutes les pages des 4 DBs
2. Construire l'index ID → titre
3. Convertir les relations (IDs Notion) en `[[title]]` via l'index

**Obsidian → Notion** :
1. Parser les `[[title]]` du frontmatter
2. Résoudre chaque titre en Notion ID via le state file
3. Mettre à jour les propriétés relationnelles

Les relations inverses (ex: Area a des Projets) sont résolues dynamiquement via le state file au moment du push vers Notion.

## Format du frontmatter Obsidian

### Ressource

```yaml
---
notion_id: "<id>"
database: "ressources"
type: "Recette"
url: "https://..."
tags: ["tag1", "tag2"]
projets:
  - "[[Projet Name]]"
areas:
  - "[[Area Name]]"
taches:
  - "[[Tâche Name]]"
ressources_liees:
  - "[[Ressource Name]]"
derniere_modification: "2026-01-25T03:14:00Z"
auteur: "Auteur"
fiction: false
genres: ["Genre1"]
lecture: "To read"
notes: "Mes notes"
rating: "🌟🌟🌟🌟"
termine: "2026-01-25"
fichiers: ["path/to/file.pdf"]
---

# Titre

Contenu markdown...
```

### Projet

```yaml
---
notion_id: "<id>"
database: "projets"
selection: "Doing"
deadline: "2024-09-01"
date_creation: "2024-08-02T17:24:00Z"
derniere_modification: "2025-07-24T14:16:00Z"
areas:
  - "[[Saas]]"
ressources:
  - "[[Ressource Name]]"
taches:
  - "[[Tâche Name]]"
---
```

### Tâche

```yaml
---
notion_id: "<id>"
database: "taches"
status: "To Do"
---
```

### Area

```yaml
---
notion_id: "<id>"
database: "areas"
date: "2024-08-02"
projets:
  - "[[Projet Name]]"
taches:
  - "[[Tâche Name]]"
ressources:
  - "[[Ressource Name]]"
---
```

## Architecture du code

```
notion-obsidian-sync/
├── src/
│   ├── index.ts              # Point d'entrée, orchestration du sync
│   ├── config.ts             # Chargement config (.env + config.yaml)
│   ├── notion/
│   │   ├── client.ts         # Client API Notion (wrapper)
│   │   ├── fetch.ts          # Récupérer les pages de chaque DB
│   │   ├── push.ts           # Créer/mettre à jour des pages Notion
│   │   └── converter.ts      # Convertir blocks Notion ↔ Markdown
│   ├── obsidian/
│   │   ├── reader.ts         # Lire/parser les fichiers du vault
│   │   ├── writer.ts         # Écrire les fichiers markdown + frontmatter
│   │   └── frontmatter.ts    # Parser/générer le YAML frontmatter
│   ├── sync/
│   │   ├── engine.ts         # Logique de sync (comparaison timestamps)
│   │   ├── relations.ts      # Résolution des relations (ID ↔ titre ↔ wikilink)
│   │   └── state.ts          # Lecture/écriture du sync-state.json
│   └── types.ts              # Types TypeScript partagés
├── config.yaml               # Config utilisateur
├── .env                      # NOTION_API_KEY
├── sync-state.json           # État de sync (auto-généré)
├── package.json
├── tsconfig.json
└── AGENTS.md
```

## Flux de synchronisation

1. Charger config + state file
2. **Notion → Obsidian**
   - Fetch toutes les pages des 4 DBs via API Notion
   - Construire l'index ID → titre
   - Pour chaque page :
     - Pas dans le state → nouvel élément → créer fichier Obsidian
     - `notion_last_edited > state.lastSync` → mettre à jour fichier Obsidian
     - `notion_last_edited <= state.lastSync` et fichier Obsidian modifié → skip (Obsidian plus récent)
3. **Obsidian → Notion**
   - Scanner le vault pour fichiers avec `notion_id` dans le frontmatter
   - Pour chaque fichier modifié depuis `state.lastSync` → mettre à jour page Notion
   - Scanner les fichiers SANS `notion_id` dans les bons dossiers → créer page dans la DB Notion correspondante
4. **Suppressions**
   - ID Notion disparu de l'API → supprimer fichier Obsidian
   - Fichier Obsidian supprimé → archiver dans Notion (pas de delete définitif)
5. Mettre à jour `sync-state.json`

## Conversion Notion Blocks ↔ Markdown

### Notion → Markdown
- `paragraph` → texte
- `heading_1/2/3` → `# / ## / ###`
- `bulleted_list_item` → `- item`
- `numbered_list_item` → `1. item`
- `to_do` → `- [ ] / - [x]`
- `code` → code blocks avec language
- `image` → `![](url)` + téléchargement optionnel
- `bookmark` → `[titre](url)`
- `embed` → lien
- `divider` → `---`

### Markdown → Notion Blocks
- Parser le markdown en blocks (heading, paragraph, list, code, etc.)
- Convertir chaque block en Notion block object
- Gérer les blocks imbriqués (listes, callouts)

## Gestion des erreurs

- **Rate limiting Notion** : Retry avec backoff exponentiel (limite 3 req/s)
- **Fichier Obsidian illisible** : Log + skip, ne pas bloquer la sync
- **Référence cassée** (wikilink vers page inexistante) : Log warning + garder le texte brut
- **Première sync** : Pas de state file → tout traiter comme nouveau
- **Network error** : Retry 3 fois puis abort avec message clair

## Dépendances

```json
{
  "@notionhq/client": "API Notion officielle",
  "gray-matter": "Parser/générateur frontmatter YAML",
  "js-yaml": "Manipulation YAML",
  "chalk": "Couleurs terminal",
  "dotenv": "Variables d'environnement"
}
```

## Configuration

### .env
```
NOTION_API_KEY=ntn_xxx
```

### config.yaml
```yaml
obsidian:
  vault_path: "../../obsidian"

notion:
  databases:
    areas: "deb9c92e8cb24f5cb1c24fbf61287e43"
    projets: "1a423b80d7344b2b8baafa274e86283b"
    taches: "31b68381b1d5465eb944ce92b670bd69"
    ressources: "d16dcb03940f4732a4e377362328f1e7"

type_to_folder:
  # Auto-découvert — pas besoin de configurer
  # Le sous-dossier = nom du type Notion
  # Ex: Type "Recette" → Ressources/Recettes/
```

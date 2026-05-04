# Notion ↔ Obsidian Sync

Bidirectional sync between a Notion PARA system (4 databases) and an Obsidian vault. Last-modified-wins conflict resolution.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure
cp .env.example .env
# Edit .env and add your Notion API key
# Edit config.yaml with your database IDs and vault path

# 3. Run sync
npm run sync
```

## Usage

```bash
npm run sync                        # Bidirectional (default)
npm run sync -- --pull              # Notion → Obsidian only
npm run sync -- --push              # Obsidian → Notion only
npm run sync -- --both              # Explicit bidirectional
```

### CLI Options

| Flag | Alias | Direction |
|------|-------|-----------|
| `--pull` | `--notion-to-obsidian` | Notion → Obsidian |
| `--push` | `--obsidian-to-notion` | Obsidian → Notion |
| `--both` | *(default)* | Bidirectional |

## Configuration

### `.env`

```
NOTION_API_KEY=ntn_your_integration_token
```

### `config.yaml`

```yaml
obsidian:
  vault_path: "../your-obsidian-vault"

notion:
  databases:
    areas: "your-areas-database-id"
    projets: "your-projets-database-id"
    taches: "your-taches-database-id"
    ressources: "your-ressources-database-id"
```

The vault path is resolved relative to `process.cwd()`.

## How It Works

### Sync Flow

1. **Fetch** — Pulls all pages from the 4 Notion databases
2. **Scan** — Reads all `.md` files from the Obsidian vault
3. **Diff** — Compares against `sync-state.json` to determine what changed
4. **Execute** — Creates, updates, or deletes files/pages as needed
5. **MOC** — Generates Map of Content notes (PARA.md, per-folder indexes)

### Conflict Resolution

When both sides modified the same item, **the last-modified version wins** based on timestamps.

### File Downloads

Notion file attachments (images, PDFs, videos) are downloaded to `PARA/attachments/` and URLs in content/frontmatter are replaced with local paths. Downloads are cached — re-running sync won't re-download.

## Vault Structure

```
Vault/
├── PARA/
│   ├── Areas/          # One .md per area
│   ├── Projets/        # One .md per project
│   ├── Ressources/     # Organized by type subfolder
│   │   ├── Recettes/
│   │   ├── Books/
│   │   ├── Articles/
│   │   └── ...
│   ├── Tâches/         # Organized by status subfolder
│   │   ├── To Do/
│   │   ├── En cours/
│   │   ├── Done/
│   │   ├── Backlog/
│   │   └── Canceled/
│   └── attachments/    # Downloaded files from Notion
├── AI/                 # obsidian-wiki zone (not synced)
└── PARA.md             # Root MOC (auto-generated)
```

## Frontmatter Format

Each synced file has YAML frontmatter with a `notion_id` linking it to its Notion page:

```yaml
---
notion_id: "abc123"
database: "ressources"
type: "Recette"
derniere_modification: "2026-01-25T03:14:00Z"
tags: ["tag1", "tag2"]
projets:
  - "[[Project Name]]"
---
```

## Development

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

Tech stack: TypeScript, Vitest, `@notionhq/client`, `gray-matter`, `js-yaml`, `chalk`.

## Reset Sync State

To force a full re-sync from scratch:

```bash
rm sync-state.json
npm run sync
```

## Notion Integration Setup

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the API key to `.env`
4. Share each database with the integration (database → `...` → `Connect to` → your integration)

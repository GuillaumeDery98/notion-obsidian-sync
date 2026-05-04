# notion-obsidian-sync

## Stack

TypeScript ESM project (`"type": "module"`). Runs via `tsx` (no build step needed for dev). Test runner: Vitest.

## Commands

- `npm run sync` — bidirectional sync (default)
- `npm run sync -- --pull` — Notion → Obsidian only
- `npm run sync -- --push` — Obsidian → Notion only
- `npm run sync -- --both` — explicit bidirectional
- `npm test` — run all tests once
- `npm run test:watch` — watch mode

No linter or formatter is configured.

## Environment

Requires a `.env` file with:

```
NOTION_API_KEY=<notion_integration_token>
```

Also requires `config.yaml` in project root (database IDs, vault path). The vault path is resolved relative to `process.cwd()`.

## Architecture

Entry point: `src/index.ts` → parses CLI args → loads config → calls `executeSync(config, direction)`.

**Data flow:**
1. `notion/fetch.ts` — pulls pages from 4 Notion databases (areas, projets, taches, ressources)
2. `sync/engine.ts` — computes diff actions (create/update/delete in both directions) using `sync-state.json`, executes them
3. `notion/converter.ts` — converts Notion blocks ↔ Markdown
4. `notion/properties.ts` — maps Notion properties to frontmatter fields per database type
5. `obsidian/writer.ts` / `obsidian/reader.ts` — write/read `.md` files with YAML frontmatter
6. `obsidian/frontmatter.ts` — parse/generate YAML frontmatter
7. `obsidian/moc.ts` — generates Map of Content notes after sync
8. `sync/state.ts` — persists sync state to `sync-state.json` (gitignored)
9. `sync/relations.ts` — resolves relations (Notion IDs ↔ wikilinks ↔ titles)
10. `sync/files.ts` — downloads Notion files to `PARA/attachments/`, replaces URLs in content/frontmatter

**Key types** in `src/types.ts`: `NotionPage`, `ObsidianFile`, `SyncState`, `PageState`, `SyncResult`, `FileInfo`.

**Folder mapping** in `src/types.ts`:
- `DATABASE_FOLDERS` — maps database type to Obsidian folder (e.g. `taches` → `PARA/Tâches`)
- `TYPE_TO_FOLDER` — maps Notion "Type" property values to subfolders under `PARA/Ressources/`
- `STATUS_FOLDERS` — maps task statuses to subfolders under `PARA/Tâches/`
- `FOLDER_TO_TYPE` — reverse mapping (subfolder → Notion type)

**Sync direction type**: `SyncDirection = 'both' | 'notion-to-obsidian' | 'obsidian-to-notion'` defined in `src/sync/engine.ts`.

**Sync actions**: `create-in-obsidian`, `update-in-obsidian`, `delete-in-obsidian`, `create-in-notion`, `update-in-notion`, `archive-in-notion`.

## Conventions

- **All local imports use `.js` extensions** (e.g. `import { foo } from './bar.js'`). Required for ESM resolution with `tsx`. Do not omit the extension.
- Tests import from `../src/...` paths directly (no path aliases configured).
- Frontmatter is in French (`derniere_modification`, `notion_id`).
- Conflict resolution: last-modified-wins based on timestamps.
- Filenames are truncated at 80 chars; the full title is added as an H1 in the body when truncated.
- Notion `Status` property uses `status` type (not `select`) — always handle both: `properties.Status?.status?.name ?? properties.Status?.select?.name`.
- File downloads go to `PARA/attachments/` with naming `{basename}_{shortId}.{ext}`.
- MOC files have `moc: true` in frontmatter and are excluded from Notion sync.

## Testing

Tests are pure unit tests (no network calls, no filesystem fixtures beyond temp dirs in config tests). E2E tests exercise the sync pipeline with in-memory data. 91 tests total.

## Sync State

`sync-state.json` tracks:
- `lastSync` — ISO timestamp of last successful sync
- `pages` — mapping of Notion page ID → `PageState` (title, database, obsidianPath, edit timestamps, deleted flag)
- `files` — mapping of local file path → `FileInfo` (notionPageId, originalUrl, downloadedAt)

It is gitignored — each environment maintains its own state.

## Vault Structure

```
Vault/
├── PARA/
│   ├── Areas/        # One .md per area
│   ├── Projets/      # One .md per project
│   ├── Ressources/   # Subfolders by Type (Recettes/, Books/, Articles/, etc.)
│   ├── Tâches/       # Subfolders by status (To Do/, En cours/, Done/, Backlog/, Canceled/)
│   └── attachments/  # Downloaded files from Notion
├── AI/               # obsidian-wiki zone (not synced with Notion)
└── PARA.md           # Root MOC (auto-generated)
```

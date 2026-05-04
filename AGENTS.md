# notion-obsidian-sync

## Stack

TypeScript ESM project (`"type": "module"`). Runs via `tsx` (no build step needed for dev). Test runner: Vitest.

## Commands

- `npm run sync` — execute the sync (reads Notion API + Obsidian vault, writes changes both ways)
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

Entry point: `src/index.ts` → loads config → calls `executeSync()`.

**Data flow:**
1. `notion/fetch.ts` — pulls pages from 4 Notion databases (areas, projets, taches, ressources)
2. `sync/engine.ts` — computes diff actions (create/update/delete in both directions) using `sync-state.json`
3. `notion/converter.ts` — converts Notion blocks ↔ Markdown
4. `obsidian/writer.ts` / `obsidian/reader.ts` — write/read `.md` files with YAML frontmatter
5. `obsidian/moc.ts` — generates Map of Content notes after sync
6. `sync/state.ts` — persists sync state to `sync-state.json` (gitignored)

**Key types** in `src/types.ts`: `NotionPage`, `ObsidianFile`, `SyncState`, `PageState`, `SyncAction`.

**Folder mapping** in `src/types.ts`:
- `DATABASE_FOLDERS` — maps database type to Obsidian folder (e.g. `taches` → `Tâches`)
- `TYPE_TO_FOLDER` — maps Notion "Type" property values to subfolders under `Ressources/`

## Conventions

- **All local imports use `.js` extensions** (e.g. `import { foo } from './bar.js'`). Required for ESM resolution with `tsx`. Do not omit the extension.
- Tests import from `../src/...` paths directly (no path aliases configured).
- Frontmatter is in French (`derniere_modification`, `notion_id`, `titre`).
- Conflict resolution: last-modified-wins based on timestamps.
- Filenames are truncated at 80 chars; the full title is added as an H1 in the body when truncated.

## Testing

Tests are pure unit tests (no network calls, no filesystem fixtures beyond temp dirs in config tests). E2E tests exercise the sync pipeline with in-memory data.

## Sync State

`sync-state.json` tracks the mapping between Notion page IDs and Obsidian file paths, plus last-sync timestamps. It is gitignored — each environment maintains its own state.

# Notion ↔ Obsidian Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bidirectional sync tool between Notion (4 PARA databases) and an Obsidian vault.

**Architecture:** Hybrid approach — Notion ID stored in YAML frontmatter + sync-state.json for timestamps and deletion tracking. TypeScript/Node.js CLI tool running via `npm run sync`. Last-modified-wins conflict resolution.

**Tech Stack:** TypeScript, Node.js, @notionhq/client, gray-matter, js-yaml, chalk, dotenv, vitest

---

## File Structure

```
notion-obsidian-sync/
├── src/
│   ├── index.ts                 # Entry point, sync orchestration
│   ├── config.ts                # Load .env + config.yaml
│   ├── types.ts                 # Shared TypeScript types + constants
│   ├── notion/
│   │   ├── client.ts            # Notion API client with rate limiting + retry
│   │   ├── fetch.ts             # Fetch all pages from 4 DBs
│   │   ├── push.ts              # Create/update Notion pages
│   │   └── converter.ts         # Notion blocks ↔ Markdown conversion
│   ├── obsidian/
│   │   ├── reader.ts            # Scan vault, parse files
│   │   ├── writer.ts            # Write markdown + frontmatter files
│   │   └── frontmatter.ts       # Parse/generate YAML frontmatter
│   └── sync/
│       ├── engine.ts            # Main sync logic (timestamp comparison)
│       ├── relations.ts         # Resolve ID ↔ title ↔ wikilink
│       └── state.ts             # Read/write sync-state.json
├── tests/
│   ├── notion/
│   │   ├── converter.test.ts
│   │   ├── fetch.test.ts
│   │   └── push.test.ts
│   ├── obsidian/
│   │   ├── frontmatter.test.ts
│   │   ├── reader.test.ts
│   │   └── writer.test.ts
│   ├── sync/
│   │   ├── engine.test.ts
│   │   ├── relations.test.ts
│   │   └── state.test.ts
│   └── config.test.ts
├── config.yaml
├── .env
├── .gitignore
├── vitest.config.ts
├── package.json
├── tsconfig.json
└── sync-state.json               # Auto-generated at runtime
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `config.yaml`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "notion-obsidian-sync",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "sync": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "chalk": "^5.3.0",
    "dotenv": "^16.4.5",
    "gray-matter": "^4.0.3",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "declaration": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
sync-state.json
*.js.map
.DS_Store
```

- [ ] **Step 5: Create config.yaml**

```yaml
obsidian:
  vault_path: "../../obsidian"

notion:
  databases:
    areas: "deb9c92e8cb24f5cb1c24fbf61287e43"
    projets: "1a423b80d7344b2b8baafa274e86283b"
    taches: "31b68381b1d5465eb944ce92b670bd69"
    ressources: "d16dcb03940f4732a4e377362328f1e7"
```

- [ ] **Step 6: Create .env (placeholder)**

```
NOTION_API_KEY=ntn_xxx
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`

- [ ] **Step 8: Verify setup**

Run: `npx tsc --noEmit`
Expected: No errors (no source files yet)

- [ ] **Step 9: Commit**

```bash
git init && git add -A && git commit -m "chore: project scaffold with TypeScript, vitest, dependencies"
```

---

### Task 2: Types & Constants

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write src/types.ts**

```typescript
export type DatabaseType = 'areas' | 'projets' | 'taches' | 'ressources';

export interface SyncConfig {
  notionApiKey: string;
  obsidianVaultPath: string;
  notionDatabases: {
    areas: string;
    projets: string;
    taches: string;
    ressources: string;
  };
}

export interface NotionPage {
  id: string;
  database: DatabaseType;
  title: string;
  properties: Record<string, any>;
  lastEditedTime: string;
  createdTime: string;
  blocks: NotionBlock[];
  archived: boolean;
}

export interface NotionBlock {
  type: string;
  id?: string;
  [key: string]: any;
}

export interface ObsidianFile {
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  database?: DatabaseType;
}

export interface SyncState {
  lastSync: string;
  pages: Record<string, PageState>;
}

export interface PageState {
  notionId: string;
  title: string;
  database: DatabaseType;
  obsidianPath: string;
  lastNotionEdit: string;
  lastObsidianEdit: string;
  lastSync: string;
  deleted: boolean;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: SyncError[];
}

export interface SyncError {
  notionId?: string;
  path?: string;
  message: string;
  phase: 'notion-to-obsidian' | 'obsidian-to-notion' | 'deletion';
}

export const DATABASE_FOLDERS: Record<DatabaseType, string> = {
  areas: 'Areas',
  projets: 'Projets',
  taches: 'Tâches',
  ressources: 'Ressources',
};

export const TYPE_TO_FOLDER: Record<string, string> = {
  'Recette': 'Recettes',
  'Book': 'Books',
  'Book note': 'Notes de livre',
  'Business Idea': 'Business Ideas',
  'Business take': 'Business takes',
  'Tool': 'Outils',
  'Article': 'Articles',
  'Training notes': 'Notes de formation',
  'Idea': 'Idées',
  'Film': 'Films',
  'Invest Idea': 'Invest Ideas',
  'Autre': 'Autres',
};

export const FOLDER_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_FOLDER).map(([type, folder]) => [folder, type])
);
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts && git commit -m "feat: shared TypeScript types and constants"
```

---

### Task 3: Configuration Module

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('loadConfig', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-config-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    await fs.writeFile(
      path.join(tmpDir, 'config.yaml'),
      [
        'obsidian:',
        '  vault_path: "./vault"',
        'notion:',
        '  databases:',
        '    areas: "area-id"',
        '    projets: "proj-id"',
        '    taches: "task-id"',
        '    ressources: "res-id"',
      ].join('\n')
    );
  });

  afterEach(async () => {
    process.chdir(origCwd);
    await fs.rm(tmpDir, { recursive: true });
  });

  it('loads config from config.yaml and env', async () => {
    process.env.NOTION_API_KEY = 'test-key';
    const config = await loadConfig();
    expect(config.notionApiKey).toBe('test-key');
    expect(config.obsidianVaultPath).toBe(path.resolve(tmpDir, './vault'));
    expect(config.notionDatabases.areas).toBe('area-id');
    expect(config.notionDatabases.ressources).toBe('res-id');
    delete process.env.NOTION_API_KEY;
  });

  it('throws if NOTION_API_KEY is missing', async () => {
    delete process.env.NOTION_API_KEY;
    await expect(loadConfig()).rejects.toThrow('NOTION_API_KEY');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement src/config.ts**

```typescript
import dotenv from 'dotenv';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { SyncConfig } from './types.js';

dotenv.config();

export async function loadConfig(): Promise<SyncConfig> {
  const configPath = path.resolve(process.cwd(), 'config.yaml');
  const raw = await fs.readFile(configPath, 'utf-8');
  const parsed = yaml.load(raw) as any;

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error('NOTION_API_KEY is required in .env');
  }

  return {
    notionApiKey: apiKey,
    obsidianVaultPath: path.resolve(process.cwd(), parsed.obsidian.vault_path),
    notionDatabases: parsed.notion.databases,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts && git commit -m "feat: configuration loading from .env + config.yaml"
```

---

### Task 4: State File Management

**Files:**
- Create: `src/sync/state.ts`
- Create: `tests/sync/state.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/sync/state.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadState, saveState, getPageState, setPageState, findByTitle, findByObsidianPath } from '../../src/sync/state.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SyncState, PageState } from '../../src/types.js';

describe('state', () => {
  let tmpDir: string;
  let origCwd: string;
  const statePath = () => path.join(tmpDir, 'sync-state.json');

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-state-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(origCwd);
    await fs.rm(tmpDir, { recursive: true });
  });

  describe('loadState', () => {
    it('returns empty state when no file exists', async () => {
      const state = await loadState();
      expect(state).toEqual({ lastSync: '', pages: {} });
    });

    it('loads existing state from file', async () => {
      const existing: SyncState = {
        lastSync: '2026-01-01T00:00:00Z',
        pages: {
          page1: {
            notionId: 'page1',
            title: 'Test',
            database: 'taches',
            obsidianPath: 'Tâches/Test.md',
            lastNotionEdit: '2026-01-01T00:00:00Z',
            lastObsidianEdit: '2026-01-01T00:00:00Z',
            lastSync: '2026-01-01T00:00:00Z',
            deleted: false,
          },
        },
      };
      await fs.writeFile(statePath(), JSON.stringify(existing));
      const state = await loadState();
      expect(state.lastSync).toBe('2026-01-01T00:00:00Z');
      expect(state.pages['page1'].title).toBe('Test');
    });
  });

  describe('saveState', () => {
    it('writes state as formatted JSON', async () => {
      const state: SyncState = { lastSync: '2026-01-01T00:00:00Z', pages: {} };
      await saveState(state);
      const raw = await fs.readFile(statePath(), 'utf-8');
      expect(JSON.parse(raw)).toEqual(state);
    });
  });

  describe('getPageState', () => {
    it('finds page by notion ID', () => {
      const state: SyncState = {
        lastSync: '',
        pages: {
          abc: { notionId: 'abc', title: 'X', database: 'areas', obsidianPath: 'Areas/X.md', lastNotionEdit: '', lastObsidianEdit: '', lastSync: '', deleted: false } as PageState,
        },
      };
      expect(getPageState(state, 'abc')?.title).toBe('X');
      expect(getPageState(state, 'missing')).toBeUndefined();
    });
  });

  describe('setPageState', () => {
    it('adds or updates page state immutably', () => {
      const state: SyncState = { lastSync: '', pages: {} };
      const page: PageState = {
        notionId: 'p1', title: 'New', database: 'projets', obsidianPath: 'Projets/New.md',
        lastNotionEdit: '', lastObsidianEdit: '', lastSync: '', deleted: false,
      };
      const updated = setPageState(state, page);
      expect(updated.pages['p1'].title).toBe('New');
      expect(state.pages['p1']).toBeUndefined();
    });
  });

  describe('findByTitle', () => {
    it('finds page by title (case-insensitive)', () => {
      const state: SyncState = {
        lastSync: '',
        pages: {
          x: { notionId: 'x', title: 'SelfFeed', database: 'projets', obsidianPath: '', lastNotionEdit: '', lastObsidianEdit: '', lastSync: '', deleted: false } as PageState,
        },
      };
      expect(findByTitle(state, 'SelfFeed')?.notionId).toBe('x');
      expect(findByTitle(state, 'selffeed')?.notionId).toBe('x');
      expect(findByTitle(state, 'missing')).toBeUndefined();
    });
  });

  describe('findByObsidianPath', () => {
    it('finds page by obsidian path', () => {
      const state: SyncState = {
        lastSync: '',
        pages: {
          y: { notionId: 'y', title: 'T', database: 'taches', obsidianPath: 'Tâches/T.md', lastNotionEdit: '', lastObsidianEdit: '', lastSync: '', deleted: false } as PageState,
        },
      };
      expect(findByObsidianPath(state, 'Tâches/T.md')?.notionId).toBe('y');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sync/state.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement src/sync/state.ts**

```typescript
import fs from 'fs/promises';
import { SyncState, PageState } from '../types.js';

const STATE_FILE = 'sync-state.json';

export async function loadState(): Promise<SyncState> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastSync: '', pages: {} };
  }
}

export async function saveState(state: SyncState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export function getPageState(state: SyncState, notionId: string): PageState | undefined {
  return state.pages[notionId];
}

export function setPageState(state: SyncState, page: PageState): SyncState {
  return {
    ...state,
    pages: {
      ...state.pages,
      [page.notionId]: page,
    },
  };
}

export function findByTitle(state: SyncState, title: string): PageState | undefined {
  const lower = title.toLowerCase();
  return Object.values(state.pages).find(p => p.title.toLowerCase() === lower);
}

export function findByObsidianPath(state: SyncState, obsidianPath: string): PageState | undefined {
  return Object.values(state.pages).find(p => p.obsidianPath === obsidianPath);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/sync/state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/sync/state.ts tests/sync/state.test.ts && git commit -m "feat: sync state file management with CRUD operations"
```

---

### Task 5: Notion Client Wrapper

**Files:**
- Create: `src/notion/client.ts`

- [ ] **Step 1: Write src/notion/client.ts**

```typescript
import { Client } from '@notionhq/client';

let clientInstance: Client | null = null;

export function getNotionClient(apiKey: string): Client {
  if (!clientInstance) {
    clientInstance = new Client({ auth: apiKey });
  }
  return clientInstance;
}

export function resetClient(): void {
  clientInstance = null;
}

let lastRequestTime = 0;
const MIN_INTERVAL = 334;

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const now = Date.now();
      const elapsed = now - lastRequestTime;
      if (elapsed < MIN_INTERVAL) {
        await new Promise(r => setTimeout(r, MIN_INTERVAL - elapsed));
      }
      lastRequestTime = Date.now();
      return await fn();
    } catch (error: any) {
      const isRetryable = error?.status === 429 || error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT';
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      const retryAfter = error?.headers?.['retry-after']
        ? parseInt(error.headers['retry-after']) * 1000
        : Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, retryAfter));
    }
  }
  throw new Error('Max retries exceeded');
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/notion/client.ts && git commit -m "feat: Notion API client with rate limiting and retry"
```

---

### Task 6: Notion Page Fetcher

**Files:**
- Create: `src/notion/fetch.ts`
- Create: `tests/notion/fetch.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/notion/fetch.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages, fetchAllDatabases } from '../../src/notion/fetch.js';

function mockClient(pages: any[]) {
  return {
    databases: {
      query: vi.fn().mockResolvedValue({
        results: pages,
        has_more: false,
        next_cursor: null,
      }),
    },
    blocks: {
      children: {
        list: vi.fn().mockResolvedValue({
          results: [],
          has_more: false,
          next_cursor: null,
        }),
      },
    },
  } as any;
}

describe('fetchAllPages', () => {
  it('fetches pages from a database and extracts titles', async () => {
    const client = mockClient([
      {
        id: 'page-1',
        last_edited_time: '2026-01-01T00:00:00Z',
        created_time: '2026-01-01T00:00:00Z',
        archived: false,
        properties: {
          Nom: { type: 'title', title: [{ plain_text: 'SelfFeed' }] },
        },
      },
    ]);

    const pages = await fetchAllPages(client, 'db-id', 'projets');
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('SelfFeed');
    expect(pages[0].database).toBe('projets');
  });

  it('handles pagination', async () => {
    const client = {
      databases: {
        query: vi.fn()
          .mockResolvedValueOnce({
            results: [{ id: 'p1', properties: { Nom: { type: 'title', title: [{ plain_text: 'A' }] } }, last_edited_time: '', created_time: '', archived: false }],
            has_more: true,
            next_cursor: 'cursor1',
          })
          .mockResolvedValueOnce({
            results: [{ id: 'p2', properties: { Nom: { type: 'title', title: [{ plain_text: 'B' }] } }, last_edited_time: '', created_time: '', archived: false }],
            has_more: false,
            next_cursor: null,
          }),
      },
      blocks: {
        children: {
          list: vi.fn().mockResolvedValue({ results: [], has_more: false, next_cursor: null }),
        },
      },
    } as any;

    const pages = await fetchAllPages(client, 'db-id', 'taches');
    expect(pages).toHaveLength(2);
    expect(client.databases.query).toHaveBeenCalledTimes(2);
  });
});

describe('fetchAllDatabases', () => {
  it('fetches from all 4 databases', async () => {
    const client = mockClient([
      {
        id: 'p1',
        last_edited_time: '',
        created_time: '',
        archived: false,
        properties: { Nom: { type: 'title', title: [{ plain_text: 'Test' }] } },
      },
    ]);

    const dbs = {
      areas: 'area-id',
      projets: 'proj-id',
      taches: 'task-id',
      ressources: 'res-id',
    };

    const pages = await fetchAllDatabases(client, dbs);
    expect(pages).toHaveLength(4);
    expect(pages.map(p => p.database).sort()).toEqual(['areas', 'projets', 'ressources', 'taches']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notion/fetch.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement src/notion/fetch.ts**

```typescript
import { Client } from '@notionhq/client';
import { NotionPage, DatabaseType } from '../types.js';
import { withRetry } from './client.js';

export async function fetchAllPages(
  client: Client,
  databaseId: string,
  database: DatabaseType
): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await withRetry(() =>
      client.databases.query({
        database_id: databaseId,
        start_cursor: cursor,
      })
    );

    for (const page of response.results as any[]) {
      const blocks = await fetchBlocks(client, page.id);
      pages.push({
        id: page.id,
        database,
        title: extractTitle(page),
        properties: page.properties,
        lastEditedTime: page.last_edited_time,
        createdTime: page.created_time,
        blocks,
        archived: page.archived ?? false,
      });
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

export async function fetchAllDatabases(
  client: Client,
  databases: Record<string, string>
): Promise<NotionPage[]> {
  const allPages: NotionPage[] = [];
  for (const [dbType, dbId] of Object.entries(databases)) {
    const pages = await fetchAllPages(client, dbId, dbType as DatabaseType);
    allPages.push(...pages);
  }
  return allPages;
}

function extractTitle(page: any): string {
  const props = page.properties;
  const titleProp = Object.values(props).find(
    (p: any) => p.type === 'title'
  ) as any;
  return titleProp?.title?.map((t: any) => t.plain_text).join('') ?? '';
}

async function fetchBlocks(client: Client, pageId: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;

  do {
    const response = await withRetry(() =>
      client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      })
    );
    blocks.push(...(response.results as any[]));
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return blocks;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/notion/fetch.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/notion/fetch.ts tests/notion/fetch.test.ts && git commit -m "feat: Notion page fetcher with pagination support"
```

---

### Task 7: Notion ↔ Markdown Converter

**Files:**
- Create: `src/notion/converter.ts`
- Create: `tests/notion/converter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/notion/converter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { notionToMarkdown, markdownToNotionBlocks } from '../../src/notion/converter.js';

describe('notionToMarkdown', () => {
  it('converts paragraph blocks', () => {
    const blocks = [
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Hello world', type: 'text', text: { content: 'Hello world' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('Hello world');
  });

  it('converts heading blocks', () => {
    const blocks = [
      { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Title', type: 'text', text: { content: 'Title' } }] } },
      { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Subtitle', type: 'text', text: { content: 'Subtitle' } }] } },
      { type: 'heading_3', heading_3: { rich_text: [{ plain_text: 'Section', type: 'text', text: { content: 'Section' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('# Title\n\n## Subtitle\n\n### Section');
  });

  it('converts list blocks', () => {
    const blocks = [
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Item 1', type: 'text', text: { content: 'Item 1' } }] } },
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Item 2', type: 'text', text: { content: 'Item 2' } }] } },
      { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'First', type: 'text', text: { content: 'First' } }] } },
      { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'Second', type: 'text', text: { content: 'Second' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('- Item 1\n- Item 2\n\n1. First\n2. Second');
  });

  it('converts to_do blocks', () => {
    const blocks = [
      { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Task', type: 'text', text: { content: 'Task' } }], checked: true } },
      { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Todo', type: 'text', text: { content: 'Todo' } }], checked: false } },
    ];
    expect(notionToMarkdown(blocks)).toBe('- [x] Task\n- [ ] Todo');
  });

  it('converts code blocks', () => {
    const blocks = [
      { type: 'code', code: { rich_text: [{ plain_text: 'const x = 1;', type: 'text', text: { content: 'const x = 1;' } }], language: 'typescript' } },
    ];
    expect(notionToMarkdown(blocks)).toBe('```typescript\nconst x = 1;\n```');
  });

  it('converts divider', () => {
    const blocks = [
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Above', type: 'text', text: { content: 'Above' } }] } },
      { type: 'divider', divider: {} },
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Below', type: 'text', text: { content: 'Below' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('Above\n\n---\n\nBelow');
  });

  it('converts quote blocks', () => {
    const blocks = [
      { type: 'quote', quote: { rich_text: [{ plain_text: 'Citation', type: 'text', text: { content: 'Citation' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('> Citation');
  });

  it('converts image blocks', () => {
    const blocks = [
      { type: 'image', image: { type: 'external', external: { url: 'https://example.com/img.png' }, caption: [] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('![](https://example.com/img.png)');
  });

  it('converts bookmark blocks', () => {
    const blocks = [
      { type: 'bookmark', bookmark: { url: 'https://example.com', caption: [] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('[https://example.com](https://example.com)');
  });

  it('handles inline rich text formatting', () => {
    const blocks = [
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { plain_text: 'Hello ', type: 'text', text: { content: 'Hello ' } },
            { plain_text: 'world', type: 'text', text: { content: 'world' }, annotations: { bold: true, italic: false, strikethrough: false, code: false, underline: false, color: 'default' } },
            { plain_text: ' and ', type: 'text', text: { content: ' and ' } },
            { plain_text: 'code', type: 'text', text: { content: 'code' }, annotations: { bold: false, italic: false, strikethrough: false, code: true, underline: false, color: 'default' } },
          ],
        },
      },
    ];
    expect(notionToMarkdown(blocks)).toBe('Hello **world** and `code`');
  });

  it('returns empty string for empty blocks', () => {
    expect(notionToMarkdown([])).toBe('');
  });
});

describe('markdownToNotionBlocks', () => {
  it('converts headings', () => {
    const blocks = markdownToNotionBlocks('# Title\n\n## Sub\n\n### Section');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('heading_1');
    expect(blocks[1].type).toBe('heading_2');
    expect(blocks[2].type).toBe('heading_3');
  });

  it('converts paragraphs', () => {
    const blocks = markdownToNotionBlocks('Hello world');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
  });

  it('converts bullet lists', () => {
    const blocks = markdownToNotionBlocks('- Item 1\n- Item 2');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('bulleted_list_item');
    expect(blocks[1].type).toBe('bulleted_list_item');
  });

  it('converts numbered lists', () => {
    const blocks = markdownToNotionBlocks('1. First\n2. Second');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('numbered_list_item');
    expect(blocks[1].type).toBe('numbered_list_item');
  });

  it('converts checkboxes', () => {
    const blocks = markdownToNotionBlocks('- [x] Done\n- [ ] Todo');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('to_do');
    expect((blocks[0] as any).to_do.checked).toBe(true);
    expect((blocks[1] as any).to_do.checked).toBe(false);
  });

  it('converts code blocks', () => {
    const blocks = markdownToNotionBlocks('```ts\ncode\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('code');
    expect((blocks[0] as any).code.language).toBe('ts');
  });

  it('converts quotes', () => {
    const blocks = markdownToNotionBlocks('> Citation');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('quote');
  });

  it('converts dividers', () => {
    const blocks = markdownToNotionBlocks('Above\n\n---\n\nBelow');
    expect(blocks).toHaveLength(3);
    expect(blocks[1].type).toBe('divider');
  });

  it('handles empty input', () => {
    expect(markdownToNotionBlocks('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/notion/converter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement src/notion/converter.ts**

```typescript
export function notionToMarkdown(blocks: any[]): string {
  if (!blocks.length) return '';

  const lines: string[] = [];
  let prevType: string | null = null;

  for (const block of blocks) {
    const type = block.type;
    const needsBlankLine = prevType !== null && !isListType(type, prevType);
    if (needsBlankLine) lines.push('');

    switch (type) {
      case 'paragraph':
        lines.push(richTextToMarkdown(block.paragraph.rich_text));
        break;
      case 'heading_1':
        lines.push('# ' + richTextToMarkdown(block.heading_1.rich_text));
        break;
      case 'heading_2':
        lines.push('## ' + richTextToMarkdown(block.heading_2.rich_text));
        break;
      case 'heading_3':
        lines.push('### ' + richTextToMarkdown(block.heading_3.rich_text));
        break;
      case 'bulleted_list_item':
        lines.push('- ' + richTextToMarkdown(block.bulleted_list_item.rich_text));
        break;
      case 'numbered_list_item':
        lines.push('1. ' + richTextToMarkdown(block.numbered_list_item.rich_text));
        break;
      case 'to_do':
        const checked = block.to_do.checked ? 'x' : ' ';
        lines.push(`- [${checked}] ` + richTextToMarkdown(block.to_do.rich_text));
        break;
      case 'code':
        const lang = block.code.language || '';
        const code = richTextToMarkdown(block.code.rich_text);
        lines.push('```' + lang + '\n' + code + '\n```');
        break;
      case 'quote':
        lines.push('> ' + richTextToMarkdown(block.quote.rich_text));
        break;
      case 'divider':
        lines.push('---');
        break;
      case 'image':
        const imgUrl = block.image.type === 'external'
          ? block.image.external.url
          : block.image.file?.url ?? '';
        const imgCaption = block.image.caption?.length
          ? richTextToMarkdown(block.image.caption)
          : '';
        lines.push(`![${imgCaption}](${imgUrl})`);
        break;
      case 'bookmark':
        lines.push(`[${block.bookmark.url}](${block.bookmark.url})`);
        break;
      case 'embed':
        lines.push(`[${block.embed.url}](${block.embed.url})`);
        break;
      default:
        if (block[type]?.rich_text) {
          lines.push(richTextToMarkdown(block[type].rich_text));
        }
    }

    prevType = type;
  }

  return lines.join('\n');
}

function isListType(a: string, b: string): boolean {
  const listTypes = new Set(['bulleted_list_item', 'numbered_list_item', 'to_do']);
  return listTypes.has(a) && listTypes.has(b);
}

function richTextToMarkdown(richText: any[]): string {
  if (!richText?.length) return '';
  return richText.map((rt: any) => {
    let text = rt.plain_text ?? rt.text?.content ?? '';
    const ann = rt.annotations;
    if (ann) {
      if (ann.bold) text = `**${text}**`;
      if (ann.italic) text = `*${text}*`;
      if (ann.strikethrough) text = `~~${text}~~`;
      if (ann.code) text = `\`${text}\``;
    }
    if (rt.href) {
      text = `[${text}](${rt.href})`;
    }
    return text;
  }).join('');
}

export function markdownToNotionBlocks(markdown: string): any[] {
  if (!markdown.trim()) return [];

  const blocks: any[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({
        type: 'heading_3',
        heading_3: { rich_text: [makeTextObj(line.slice(4))] },
      });
      i++;
    } else if (line.startsWith('## ')) {
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: [makeTextObj(line.slice(3))] },
      });
      i++;
    } else if (line.startsWith('# ')) {
      blocks.push({
        type: 'heading_1',
        heading_1: { rich_text: [makeTextObj(line.slice(2))] },
      });
      i++;
    } else if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({
        type: 'code',
        code: {
          rich_text: [makeTextObj(codeLines.join('\n'))],
          language: lang || 'plain text',
        },
      });
    } else if (line.startsWith('> ')) {
      blocks.push({
        type: 'quote',
        quote: { rich_text: [makeTextObj(line.slice(2))] },
      });
      i++;
    } else if (line === '---') {
      blocks.push({ type: 'divider', divider: {} });
      i++;
    } else if (line.match(/^- \[([ xX])\] /)) {
      const checked = line[3] !== ' ';
      const text = line.slice(6);
      blocks.push({
        type: 'to_do',
        to_do: { rich_text: [makeTextObj(text)], checked },
      });
      i++;
    } else if (line.startsWith('- ')) {
      blocks.push({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [makeTextObj(line.slice(2))] },
      });
      i++;
    } else if (line.match(/^\d+\. /)) {
      const text = line.replace(/^\d+\. /, '');
      blocks.push({
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: [makeTextObj(text)] },
      });
      i++;
    } else {
      blocks.push({
        type: 'paragraph',
        paragraph: { rich_text: [makeTextObj(line)] },
      });
      i++;
    }
  }

  return blocks;
}

function makeTextObj(text: string): any {
  return {
    type: 'text',
    text: { content: text },
    plain_text: text,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/notion/converter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/notion/converter.ts tests/notion/converter.test.ts && git commit -m "feat: bidirectional Notion blocks ↔ Markdown converter"
```

---

### Task 8: Notion Push (Create & Update Pages)

**Files:**
- Create: `src/notion/push.ts`
- Create: `tests/notion/push.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/notion/push.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createNotionPage, updateNotionPage, buildNotionProperties } from '../../src/notion/push.js';
import { ObsidianFile, SyncConfig } from '../../src/types.js';

const baseConfig: SyncConfig = {
  notionApiKey: 'test-key',
  obsidianVaultPath: '/vault',
  notionDatabases: {
    areas: 'area-db',
    projets: 'proj-db',
    taches: 'task-db',
    ressources: 'res-db',
  },
};

describe('buildNotionProperties', () => {
  it('builds title property from filename', () => {
    const file: ObsidianFile = {
      path: 'Tâches/Faire les courses.md',
      frontmatter: { database: 'taches', notion_id: 'abc', status: 'To Do' },
      content: 'Body',
      database: 'taches',
    };
    const props = buildNotionProperties(file, 'taches');
    expect(props.Nom.title[0].text.content).toBe('Faire les courses');
    expect(props.Status.select.name).toBe('To Do');
  });

  it('builds ressource properties with type and relations', () => {
    const file: ObsidianFile = {
      path: 'Ressources/Recettes/Poulet.md',
      frontmatter: {
        database: 'ressources',
        notion_id: 'r1',
        type: 'Recette',
        url: 'https://example.com',
        tags: ['tag1', 'tag2'],
        projets: ['[[SelfFeed]]'],
      },
      content: '',
      database: 'ressources',
    };
    const props = buildNotionProperties(file, 'ressources');
    expect(props.Nom.title[0].text.content).toBe('Poulet');
    expect(props.Type.select.name).toBe('Recette');
    expect(props.URL.url).toBe('https://example.com');
    expect(props.Tags.multi_select).toEqual([{ name: 'tag1' }, { name: 'tag2' }]);
  });

  it('builds projet properties', () => {
    const file: ObsidianFile = {
      path: 'Projets/SelfFeed.md',
      frontmatter: {
        database: 'projets',
        notion_id: 'p1',
        selection: 'Doing',
        deadline: '2024-09-01',
      },
      content: '',
      database: 'projets',
    };
    const props = buildNotionProperties(file, 'projets');
    expect(props.Nom.title[0].text.content).toBe('SelfFeed');
    expect(props.Sélection.select.name).toBe('Doing');
    expect(props.Deadline.date.start).toBe('2024-09-01');
  });
});

describe('createNotionPage', () => {
  it('creates a page with properties and content', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'new-page-id' });
    const mockAppend = vi.fn().mockResolvedValue({});
    const client = {
      pages: { create: mockCreate },
      blocks: { children: { append: mockAppend } },
    } as any;

    const file: ObsidianFile = {
      path: 'Tâches/New task.md',
      frontmatter: { database: 'taches', status: 'To Do' },
      content: 'Some body text',
      database: 'taches',
    };

    const pageId = await createNotionPage(client, file, baseConfig);
    expect(pageId).toBe('new-page-id');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: { database_id: 'task-db' },
      })
    );
    expect(mockAppend).toHaveBeenCalled();
  });
});

describe('updateNotionPage', () => {
  it('updates properties and content of existing page', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ id: 'existing-id' });
    const mockDelete = vi.fn().mockResolvedValue({});
    const mockAppend = vi.fn().mockResolvedValue({});
    const client = {
      pages: { update: mockUpdate },
      blocks: {
        children: {
          delete: mockDelete,
          append: mockAppend,
          list: vi.fn().mockResolvedValue({ results: [{ id: 'old-block' }], has_more: false, next_cursor: null }),
        },
      },
    } as any;

    const file: ObsidianFile = {
      path: 'Tâches/Task.md',
      frontmatter: { database: 'taches', notion_id: 'existing-id', status: 'Done' },
      content: 'Updated body',
      database: 'taches',
    };

    await updateNotionPage(client, 'existing-id', file, 'taches');
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith({ block_id: 'old-block' });
    expect(mockAppend).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/notion/push.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement src/notion/push.ts**

```typescript
import { Client } from '@notionhq/client';
import { ObsidianFile, SyncConfig, DatabaseType } from '../types.js';
import { markdownToNotionBlocks } from './converter.js';
import { withRetry } from './client.js';
import path from 'path';

export function buildNotionProperties(file: ObsidianFile, database: DatabaseType): Record<string, any> {
  const filename = path.basename(file.path, '.md');
  const fm = file.frontmatter;
  const props: Record<string, any> = {
    Nom: { title: [{ text: { content: filename } }] },
  };

  switch (database) {
    case 'areas':
      if (fm.date) props.Date = { date: { start: fm.date } };
      break;

    case 'projets':
      if (fm.selection) props.Sélection = { select: { name: fm.selection } };
      if (fm.deadline) props.Deadline = { date: { start: fm.deadline } };
      if (fm.areas) props.Areas = buildRelationFromWikilinks(fm.areas);
      if (fm.ressources) props.Ressources = buildRelationFromWikilinks(fm.ressources);
      if (fm.taches) props.Tâche = buildRelationFromWikilinks(fm.taches);
      break;

    case 'taches':
      if (fm.status) props.Status = { select: { name: fm.status } };
      break;

    case 'ressources':
      if (fm.type) props.Type = { select: { name: fm.type } };
      if (fm.url) props.URL = { url: fm.url };
      if (fm.tags?.length) props.Tags = { multi_select: fm.tags.map((t: string) => ({ name: t })) };
      if (fm.auteur) props.Auteur = { rich_text: [{ text: { content: fm.auteur } }] };
      if (fm.commence) props.Commencé = { date: { start: fm.commence } };
      if (fm.fiction !== undefined) props['Fiction ?'] = { checkbox: !!fm.fiction };
      if (fm.genres?.length) props.Genres = { multi_select: fm.genres.map((g: string) => ({ name: g })) };
      if (fm.lecture) props.Lecture = { select: { name: fm.lecture } };
      if (fm.notes) props.Notes = { rich_text: [{ text: { content: String(fm.notes) } }] };
      if (fm.rating) props.Rating = { rich_text: [{ text: { content: String(fm.rating) } }] };
      if (fm.termine) props.Terminé = { date: { start: fm.termine } };
      if (fm.projets) props.Projets = buildRelationFromWikilinks(fm.projets);
      if (fm.areas) props.Areas = buildRelationFromWikilinks(fm.areas);
      if (fm.taches) props.Tâche = buildRelationFromWikilinks(fm.taches);
      if (fm.ressources_liees) props['Ressources liée'] = buildRelationFromWikilinks(fm.ressources_liees);
      break;
  }

  return props;
}

function buildRelationFromWikilinks(wikilinks: string[]): any {
  const ids = wikilinks
    .map((wl: string) => {
      const match = wl.match(/^\[\[(.+)\]\]$/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  if (!ids.length) return undefined;

  return {
    relation: ids.map((title: string) => ({ id: title })),
  };
}

export async function createNotionPage(
  client: Client,
  file: ObsidianFile,
  config: SyncConfig,
  resolveWikilinkToId?: (title: string) => string | undefined
): Promise<string> {
  const database = file.database!;
  const dbId = config.notionDatabases[database];
  const props = resolveRelations(buildNotionProperties(file, database), resolveWikilinkToId);

  const response = await withRetry(() =>
    client.pages.create({
      parent: { database_id: dbId },
      properties: props,
    })
  );

  const pageId = (response as any).id;

  const blocks = markdownToNotionBlocks(file.content);
  if (blocks.length) {
    await withRetry(() =>
      client.blocks.children.append({
        block_id: pageId,
        children: blocks,
      })
    );
  }

  return pageId;
}

export async function updateNotionPage(
  client: Client,
  pageId: string,
  file: ObsidianFile,
  database: DatabaseType,
  resolveWikilinkToId?: (title: string) => string | undefined
): Promise<void> {
  const props = resolveRelations(buildNotionProperties(file, database), resolveWikilinkToId);

  await withRetry(() =>
    client.pages.update({
      page_id: pageId,
      properties: props,
    })
  );

  await deleteExistingBlocks(client, pageId);

  const blocks = markdownToNotionBlocks(file.content);
  if (blocks.length) {
    await withRetry(() =>
      client.blocks.children.append({
        block_id: pageId,
        children: blocks,
      })
    );
  }
}

async function deleteExistingBlocks(client: Client, pageId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const response = await withRetry(() =>
      client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      })
    );
    for (const block of response.results as any[]) {
      await withRetry(() =>
        client.blocks.delete({ block_id: block.id })
      );
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);
}

function resolveRelations(
  props: Record<string, any>,
  resolveWikilinkToId?: (title: string) => string | undefined
): Record<string, any> {
  if (!resolveWikilinkToId) return props;

  const resolved = { ...props };
  for (const [key, val] of Object.entries(resolved)) {
    if (val?.relation) {
      resolved[key] = {
        relation: val.relation
          .map((r: any) => {
            if (r.id && r.id.startsWith('[[')) {
              const title = r.id.replace(/^\[\[(.+)\]\]$/, '$1');
              const notionId = resolveWikilinkToId(title);
              return notionId ? { id: notionId } : null;
            }
            return r;
          })
          .filter(Boolean),
      };
    }
  }
  return resolved;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/notion/push.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/notion/push.ts tests/notion/push.test.ts && git commit -m "feat: Notion page creation and update with property mapping"
```

---

### Task 9: Frontmatter Parser/Generator

**Files:**
- Create: `src/obsidian/frontmatter.ts`
- Create: `tests/obsidian/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/obsidian/frontmatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, generateFrontmatter, extractTitle } from '../../src/obsidian/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter from raw file content', () => {
    const raw = '---\nnotion_id: "abc"\ndatabase: taches\nstatus: "To Do"\n---\n\nBody text';
    const result = parseFrontmatter(raw);
    expect(result.frontmatter.notion_id).toBe('abc');
    expect(result.frontmatter.database).toBe('taches');
    expect(result.frontmatter.status).toBe('To Do');
    expect(result.content).toBe('Body text');
  });

  it('handles file without frontmatter', () => {
    const raw = 'Just body text\nNo frontmatter';
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe('Just body text\nNo frontmatter');
  });

  it('parses wikilink arrays', () => {
    const raw = '---\nnotion_id: "x"\ndatabase: projets\nareas:\n  - "[[Saas]]"\n  - "[[Work]]"\n---\n\nContent';
    const result = parseFrontmatter(raw);
    expect(result.frontmatter.areas).toEqual(['[[Saas]]', '[[Work]]']);
  });

  it('parses boolean and number values', () => {
    const raw = '---\nfiction: true\nrating: 4\n---\n\nText';
    const result = parseFrontmatter(raw);
    expect(result.frontmatter.fiction).toBe(true);
    expect(result.frontmatter.rating).toBe(4);
  });
});

describe('generateFrontmatter', () => {
  it('generates YAML frontmatter with wikilink arrays', () => {
    const fm = generateFrontmatter({
      notion_id: 'abc',
      database: 'projets',
      selection: 'Doing',
      areas: ['[[Saas]]'],
    });
    expect(fm).toContain('notion_id: abc');
    expect(fm).toContain('database: projets');
    expect(fm).toContain('selection: Doing');
    expect(fm).toContain('- "[[Saas]]"');
  });

  it('handles empty frontmatter', () => {
    const fm = generateFrontmatter({});
    expect(fm).toBe('');
  });
});

describe('extractTitle', () => {
  it('extracts title from markdown heading', () => {
    expect(extractTitle('# My Title\nBody')).toBe('My Title');
  });

  it('returns empty string if no heading', () => {
    expect(extractTitle('Just body text')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/obsidian/frontmatter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement src/obsidian/frontmatter.ts**

```typescript
import matter from 'gray-matter';
import yaml from 'js-yaml';

export interface ParsedFile {
  frontmatter: Record<string, any>;
  content: string;
}

export function parseFrontmatter(raw: string): ParsedFile {
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data,
    content: parsed.content.trim(),
  };
}

export function generateFrontmatter(fm: Record<string, any>): string {
  const keys = Object.keys(fm);
  if (!keys.length) return '';

  const yamlStr = yaml.dump(fm, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    replacer: (key: string, value: any) => {
      if (typeof value === 'string' && value.startsWith('[[') && value.endsWith(']]')) {
        return value;
      }
      return value;
    },
  });

  return `---\n${yamlStr.trim()}\n---`;
}

export function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

export function buildFileContent(fm: Record<string, any>, body: string): string {
  const fmStr = generateFrontmatter(fm);
  const title = extractTitle(body) ? '' : `# ${fm.notion_id ? '' : ''}`;

  if (fmStr) {
    return `${fmStr}\n\n${body}`;
  }
  return body;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/obsidian/frontmatter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/frontmatter.ts tests/obsidian/frontmatter.test.ts && git commit -m "feat: YAML frontmatter parser and generator using gray-matter"
```

---

### Task 10: Obsidian Reader & Writer

**Files:**
- Create: `src/obsidian/reader.ts`
- Create: `src/obsidian/writer.ts`
- Create: `tests/obsidian/reader.test.ts`
- Create: `tests/obsidian/writer.test.ts`

- [ ] **Step 1: Write failing tests for reader**

Create `tests/obsidian/reader.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanVault, readFile } from '../../src/obsidian/reader.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('scanVault', () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-'));
    await fs.mkdir(path.join(vaultDir, 'Tâches'), { recursive: true });
    await fs.mkdir(path.join(vaultDir, 'Projets'), { recursive: true });
    await fs.mkdir(path.join(vaultDir, 'Ressources', 'Recettes'), { recursive: true });

    await fs.writeFile(
      path.join(vaultDir, 'Tâches', 'Task1.md'),
      '---\nnotion_id: "t1"\ndatabase: taches\nstatus: "To Do"\n---\n\nBody'
    );
    await fs.writeFile(
      path.join(vaultDir, 'Projets', 'SelfFeed.md'),
      '---\nnotion_id: "p1"\ndatabase: projets\n---\n\n# SelfFeed'
    );
    await fs.writeFile(
      path.join(vaultDir, 'Ressources', 'Recettes', 'Poulet.md'),
      '---\nnotion_id: "r1"\ndatabase: ressources\ntype: Recette\n---\n\nRecipe'
    );
    await fs.writeFile(
      path.join(vaultDir, 'Tâches', 'NewTask.md'),
      '---\nstatus: "En cours"\n---\n\nNew task without notion_id'
    );
  });

  afterEach(async () => {
    await fs.rm(vaultDir, { recursive: true });
  });

  it('scans vault and returns all markdown files with parsed frontmatter', async () => {
    const files = await scanVault(vaultDir);
    expect(files.length).toBe(4);
    const withId = files.filter(f => f.frontmatter.notion_id);
    expect(withId.length).toBe(3);
    const withoutId = files.filter(f => !f.frontmatter.notion_id);
    expect(withoutId.length).toBe(1);
    expect(withoutId[0].path).toContain('NewTask.md');
  });

  it('detects database type from folder path', async () => {
    const files = await scanVault(vaultDir);
    const task = files.find(f => f.path.includes('Task1'));
    expect(task?.database).toBe('taches');
    const recette = files.find(f => f.path.includes('Poulet'));
    expect(recette?.database).toBe('ressources');
  });
});

describe('readFile', () => {
  it('reads and parses a single file', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'read-'));
    const filePath = path.join(tmpDir, 'Test.md');
    await fs.writeFile(filePath, '---\nnotion_id: "abc"\n---\n\nContent here');
    const file = await readFile(filePath);
    expect(file.frontmatter.notion_id).toBe('abc');
    expect(file.content).toBe('Content here');
    await fs.rm(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 2: Write failing tests for writer**

Create `tests/obsidian/writer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeObsidianFile } from '../../src/obsidian/writer.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('writeObsidianFile', () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-write-'));
  });

  afterEach(async () => {
    await fs.rm(vaultDir, { recursive: true });
  });

  it('writes file with frontmatter to correct path', async () => {
    await writeObsidianFile(vaultDir, {
      path: 'Tâches/My Task.md',
      frontmatter: { notion_id: 't1', database: 'taches', status: 'To Do' },
      content: 'Task body',
      database: 'taches',
    });

    const written = await fs.readFile(path.join(vaultDir, 'Tâches', 'My Task.md'), 'utf-8');
    expect(written).toContain('notion_id: t1');
    expect(written).toContain('status: To Do');
    expect(written).toContain('Task body');
  });

  it('creates subdirectories for ressources', async () => {
    await writeObsidianFile(vaultDir, {
      path: 'Ressources/Recettes/Poulet.md',
      frontmatter: { notion_id: 'r1', database: 'ressources', type: 'Recette' },
      content: 'Recipe',
      database: 'ressources',
    });

    const written = await fs.readFile(path.join(vaultDir, 'Ressources', 'Recettes', 'Poulet.md'), 'utf-8');
    expect(written).toContain('Poulet');
  });

  it('overwrites existing file', async () => {
    const filePath = path.join(vaultDir, 'Test.md');
    await fs.writeFile(filePath, 'old content');

    await writeObsidianFile(vaultDir, {
      path: 'Test.md',
      frontmatter: { notion_id: 'x' },
      content: 'new content',
    });

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toContain('new content');
    expect(written).not.toContain('old content');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/obsidian/`
Expected: FAIL — modules not found

- [ ] **Step 4: Implement src/obsidian/reader.ts**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { ObsidianFile, DatabaseType, DATABASE_FOLDERS } from '../types.js';
import { parseFrontmatter } from './frontmatter.js';

export async function scanVault(vaultPath: string): Promise<ObsidianFile[]> {
  const files: ObsidianFile[] = [];
  await walkDir(vaultPath, vaultPath, files);
  return files;
}

async function walkDir(dir: string, vaultPath: string, files: ObsidianFile[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '.obsidian' || entry.name === '.trash') continue;
      await walkDir(fullPath, vaultPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = path.relative(vaultPath, fullPath);
      const file = await readFile(fullPath);
      file.path = relativePath;
      file.database = detectDatabase(relativePath);
      files.push(file);
    }
  }
}

export async function readFile(fullPath: string): Promise<ObsidianFile> {
  const raw = await fs.readFile(fullPath, 'utf-8');
  const parsed = parseFrontmatter(raw);
  return {
    path: fullPath,
    frontmatter: parsed.frontmatter,
    content: parsed.content,
  };
}

function detectDatabase(relativePath: string): DatabaseType | undefined {
  const topFolder = relativePath.split(path.sep)[0];
  for (const [dbType, folder] of Object.entries(DATABASE_FOLDERS)) {
    if (topFolder === folder) return dbType as DatabaseType;
  }
  return undefined;
}
```

- [ ] **Step 5: Implement src/obsidian/writer.ts**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { ObsidianFile } from '../types.js';
import { buildFileContent } from './frontmatter.js';

export async function writeObsidianFile(vaultPath: string, file: ObsidianFile): Promise<void> {
  const fullPath = path.join(vaultPath, file.path);
  const dir = path.dirname(fullPath);

  await fs.mkdir(dir, { recursive: true });

  const content = buildFileContent(file.frontmatter, file.content);
  await fs.writeFile(fullPath, content, 'utf-8');
}

export async function deleteObsidianFile(vaultPath: string, relativePath: string): Promise<void> {
  const fullPath = path.join(vaultPath, relativePath);
  try {
    await fs.unlink(fullPath);
  } catch {
    // already deleted
  }
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/obsidian/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/obsidian/reader.ts src/obsidian/writer.ts tests/obsidian/ && git commit -m "feat: Obsidian vault scanner, file reader, and writer"
```

---

### Task 11: Relation Resolution

**Files:**
- Create: `src/sync/relations.ts`
- Create: `tests/sync/relations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/sync/relations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildPageIndex,
  resolveNotionRelations,
  resolveObsidianRelations,
  notionIdsToWikilinks,
  wikilinksToTitles,
} from '../../src/sync/relations.js';
import { NotionPage, SyncState, PageState } from '../../src/types.js';

describe('buildPageIndex', () => {
  it('builds an index of notionId → title', () => {
    const pages: NotionPage[] = [
      { id: 'id-1', database: 'projets', title: 'SelfFeed', properties: {}, lastEditedTime: '', createdTime: '', blocks: [], archived: false },
      { id: 'id-2', database: 'areas', title: 'Saas', properties: {}, lastEditedTime: '', createdTime: '', blocks: [], archived: false },
      { id: 'id-3', database: 'taches', title: 'Build API', properties: {}, lastEditedTime: '', createdTime: '', blocks: [], archived: false },
    ];
    const index = buildPageIndex(pages);
    expect(index.get('id-1')).toBe('SelfFeed');
    expect(index.get('id-2')).toBe('Saas');
    expect(index.get('id-3')).toBe('Build API');
    expect(index.get('id-4')).toBeUndefined();
  });
});

describe('notionIdsToWikilinks', () => {
  it('converts array of Notion IDs to wikilink strings using index', () => {
    const index = new Map([
      ['id-1', 'SelfFeed'],
      ['id-2', 'Saas'],
    ]);
    const result = notionIdsToWikilinks(['id-1', 'id-2', 'id-unknown'], index);
    expect(result).toEqual(['[[SelfFeed]]', '[[Saas]]']);
  });

  it('returns empty array for null/undefined input', () => {
    expect(notionIdsToWikilinks(null, new Map())).toEqual([]);
    expect(notionIdsToWikilinks(undefined, new Map())).toEqual([]);
  });
});

describe('wikilinksToTitles', () => {
  it('extracts titles from wikilink arrays', () => {
    const result = wikilinksToTitles(['[[SelfFeed]]', '[[Saas]]']);
    expect(result).toEqual(['SelfFeed', 'Saas']);
  });

  it('returns empty array for null/undefined', () => {
    expect(wikilinksToTitles(null)).toEqual([]);
  });
});

describe('resolveNotionRelations', () => {
  it('converts Notion relation IDs to wikilinks using page index', () => {
    const props = {
      Projets: { type: 'relation', relation: [{ id: 'p1' }, { id: 'p2' }] },
      Areas: { type: 'relation', relation: [{ id: 'a1' }] },
      Status: { type: 'select', select: { name: 'Done' } },
    };
    const index = new Map([['p1', 'SelfFeed'], ['p2', 'Business Pro'], ['a1', 'Saas']]);

    const resolved = resolveNotionRelations(props, index);
    expect(resolved.Projets).toEqual(['[[SelfFeed]]', '[[Business Pro]]']);
    expect(resolved.Areas).toEqual(['[[Saas]]']);
    expect(resolved.Status).toBe('Done');
  });
});

describe('resolveObsidianRelations', () => {
  it('resolves wikilink titles to Notion IDs using state', () => {
    const state: SyncState = {
      lastSync: '',
      pages: {
        'p1': { notionId: 'p1', title: 'SelfFeed', database: 'projets', obsidianPath: 'Projets/SelfFeed.md', lastNotionEdit: '', lastObsidianEdit: '', lastSync: '', deleted: false },
        'a1': { notionId: 'a1', title: 'Saas', database: 'areas', obsidianPath: 'Areas/Saas.md', lastNotionEdit: '', lastObsidianEdit: '', lastSync: '', deleted: false },
      },
    };

    const result = resolveObsidianRelations(['[[SelfFeed]]', '[[Saas]]', '[[Unknown]]'], state);
    expect(result).toEqual(['p1', 'a1']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sync/relations.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement src/sync/relations.ts**

```typescript
import { NotionPage, SyncState } from '../types.js';

export function buildPageIndex(pages: NotionPage[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const page of pages) {
    index.set(page.id, page.title);
  }
  return index;
}

export function notionIdsToWikilinks(
  ids: string[] | null | undefined,
  index: Map<string, string>
): string[] {
  if (!ids?.length) return [];
  return ids
    .map(id => index.get(id))
    .filter((title): title is string => !!title)
    .map(title => `[[${title}]]`);
}

export function wikilinksToTitles(wikilinks: string[] | null | undefined): string[] {
  if (!wikilinks?.length) return [];
  return wikilinks
    .map((wl: string) => {
      const match = wl.match(/^\[\[(.+)\]\]$/);
      return match ? match[1] : null;
    })
    .filter((t): t is string => !!t);
}

export function resolveNotionRelations(
  properties: Record<string, any>,
  index: Map<string, string>
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, prop] of Object.entries(properties)) {
    if (!prop) continue;

    if (prop.type === 'relation' && prop.relation) {
      result[key] = notionIdsToWikilinks(
        prop.relation.map((r: any) => r.id),
        index
      );
    } else if (prop.type === 'select' && prop.select) {
      result[key] = prop.select.name;
    } else if (prop.type === 'multi_select' && prop.multi_select) {
      result[key] = prop.multi_select.map((s: any) => s.name);
    } else if (prop.type === 'title' && prop.title) {
      continue; // handled separately
    } else if (prop.type === 'rich_text' && prop.rich_text) {
      result[key] = prop.rich_text.map((rt: any) => rt.plain_text).join('');
    } else if (prop.type === 'date' && prop.date) {
      result[key] = prop.date.start;
    } else if (prop.type === 'checkbox') {
      result[key] = prop.checkbox;
    } else if (prop.type === 'url') {
      result[key] = prop.url;
    } else if (prop.type === 'files') {
      result[key] = prop.files?.map((f: any) => f.file?.url ?? f.external?.url).filter(Boolean) ?? [];
    } else if (prop.type === 'number') {
      result[key] = prop.number;
    }
  }

  return result;
}

export function resolveObsidianRelations(
  wikilinks: string[],
  state: SyncState
): string[] {
  const titles = wikilinksToTitles(wikilinks);
  return titles
    .map(title => {
      const page = Object.values(state.pages).find(
        p => p.title.toLowerCase() === title.toLowerCase()
      );
      return page?.notionId;
    })
    .filter((id): id is string => !!id);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/sync/relations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/sync/relations.ts tests/sync/relations.test.ts && git commit -m "feat: bidirectional relation resolution between Notion IDs and wikilinks"
```

---

### Task 12: Sync Engine

**Files:**
- Create: `src/sync/engine.ts`
- Create: `tests/sync/engine.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/sync/engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeSyncActions, SyncAction } from '../../src/sync/engine.js';
import { NotionPage, SyncState, PageState, ObsidianFile } from '../../src/types.js';

function makeNotionPage(overrides: Partial<NotionPage> = {}): NotionPage {
  return {
    id: 'p1',
    database: 'taches',
    title: 'Test',
    properties: {},
    lastEditedTime: '2026-01-15T00:00:00Z',
    createdTime: '2026-01-01T00:00:00Z',
    blocks: [],
    archived: false,
    ...overrides,
  };
}

function makePageState(overrides: Partial<PageState> = {}): PageState {
  return {
    notionId: 'p1',
    title: 'Test',
    database: 'taches',
    obsidianPath: 'Tâches/Test.md',
    lastNotionEdit: '2026-01-10T00:00:00Z',
    lastObsidianEdit: '2026-01-10T00:00:00Z',
    lastSync: '2026-01-10T00:00:00Z',
    deleted: false,
    ...overrides,
  };
}

describe('computeSyncActions', () => {
  const lastSync = '2026-01-10T00:00:00Z';

  it('creates new Obsidian file for new Notion page', () => {
    const state: SyncState = { lastSync, pages: {} };
    const notionPages = [makeNotionPage({ id: 'new-1', title: 'New Task' })];
    const obsidianFiles: ObsidianFile[] = [];

    const actions = computeSyncActions(notionPages, obsidianFiles, state);
    const create = actions.find(a => a.type === 'create-in-obsidian' && a.notionId === 'new-1');
    expect(create).toBeDefined();
  });

  it('updates Obsidian when Notion page is newer', () => {
    const state: SyncState = {
      lastSync,
      pages: {
        'p1': makePageState({ lastNotionEdit: '2026-01-10T00:00:00Z' }),
      },
    };
    const notionPages = [makeNotionPage({ lastEditedTime: '2026-01-15T00:00:00Z' })];
    const obsidianFiles: ObsidianFile[] = [];

    const actions = computeSyncActions(notionPages, obsidianFiles, state);
    const update = actions.find(a => a.type === 'update-in-obsidian' && a.notionId === 'p1');
    expect(update).toBeDefined();
  });

  it('updates Notion when Obsidian file is newer than last sync', () => {
    const state: SyncState = {
      lastSync,
      pages: {
        'p1': makePageState({ lastObsidianEdit: '2026-01-09T00:00:00Z' }),
      },
    };
    const notionPages = [makeNotionPage({ lastEditedTime: '2026-01-09T00:00:00Z' })];
    const obsidianFiles: ObsidianFile[] = [
      {
        path: 'Tâches/Test.md',
        frontmatter: { notion_id: 'p1', database: 'taches' },
        content: 'Updated',
        database: 'taches',
      },
    ];

    const actions = computeSyncActions(notionPages, obsidianFiles, state);
    const update = actions.find(a => a.type === 'update-in-notion' && a.notionId === 'p1');
    expect(update).toBeDefined();
  });

  it('deletes Obsidian file when Notion page is archived', () => {
    const state: SyncState = {
      lastSync,
      pages: {
        'p1': makePageState(),
      },
    };
    const notionPages: NotionPage[] = [];
    const obsidianFiles: ObsidianFile[] = [];

    const actions = computeSyncActions(notionPages, obsidianFiles, state);
    const del = actions.find(a => a.type === 'delete-in-obsidian' && a.notionId === 'p1');
    expect(del).toBeDefined();
    expect((del as any).obsidianPath).toBe('Tâches/Test.md');
  });

  it('creates Notion page for new Obsidian file without notion_id', () => {
    const state: SyncState = { lastSync, pages: {} };
    const notionPages: NotionPage[] = [];
    const obsidianFiles: ObsidianFile[] = [
      {
        path: 'Tâches/New task.md',
        frontmatter: { status: 'To Do' },
        content: 'New task body',
        database: 'taches',
      },
    ];

    const actions = computeSyncActions(notionPages, obsidianFiles, state);
    const create = actions.find(a => a.type === 'create-in-notion' && a.path === 'Tâches/New task.md');
    expect(create).toBeDefined();
  });

  it('skips when both sides are unchanged', () => {
    const state: SyncState = {
      lastSync,
      pages: {
        'p1': makePageState({ lastNotionEdit: '2026-01-09T00:00:00Z' }),
      },
    };
    const notionPages = [makeNotionPage({ lastEditedTime: '2026-01-09T00:00:00Z' })];
    const obsidianFiles: ObsidianFile[] = [];

    const actions = computeSyncActions(notionPages, obsidianFiles, state);
    const relevant = actions.filter(a => a.notionId === 'p1');
    expect(relevant).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement src/sync/engine.ts**

```typescript
import {
  NotionPage,
  ObsidianFile,
  SyncState,
  PageState,
  SyncResult,
  SyncError,
  DatabaseType,
  TYPE_TO_FOLDER,
  DATABASE_FOLDERS,
} from '../types.js';
import { findByObsidianPath } from './state.js';

export type SyncAction =
  | { type: 'create-in-obsidian'; notionId: string; page: NotionPage }
  | { type: 'update-in-obsidian'; notionId: string; page: NotionPage; obsidianPath: string }
  | { type: 'create-in-notion'; path: string; file: ObsidianFile }
  | { type: 'update-in-notion'; notionId: string; path: string; file: ObsidianFile }
  | { type: 'delete-in-obsidian'; notionId: string; obsidianPath: string }
  | { type: 'archive-in-notion'; notionId: string };

export function computeSyncActions(
  notionPages: NotionPage[],
  obsidianFiles: ObsidianFile[],
  state: SyncState
): SyncAction[] {
  const actions: SyncAction[] = [];
  const lastSync = state.lastSync;

  const syncedNotionIds = new Set<string>();

  for (const page of notionPages) {
    syncedNotionIds.add(page.id);
    const pageState = state.pages[page.id];

    if (!pageState) {
      actions.push({ type: 'create-in-obsidian', notionId: page.id, page });
      continue;
    }

    if (page.lastEditedTime > pageState.lastNotionEdit) {
      actions.push({
        type: 'update-in-obsidian',
        notionId: page.id,
        page,
        obsidianPath: pageState.obsidianPath,
      });
    }
  }

  for (const [notionId, pageState] of Object.entries(state.pages)) {
    if (pageState.deleted) continue;
    if (!syncedNotionIds.has(notionId)) {
      actions.push({
        type: 'delete-in-obsidian',
        notionId,
        obsidianPath: pageState.obsidianPath,
      });
    }
  }

  for (const file of obsidianFiles) {
    const notionId = file.frontmatter?.notion_id as string | undefined;

    if (notionId) {
      const pageState = state.pages[notionId];
      if (pageState && lastSync) {
        const obsidianMtime = file.frontmatter?.derniere_modification as string | undefined;
        if (!obsidianMtime || obsidianMtime > pageState.lastSync) {
          const alreadyUpdatingFromNotion = actions.some(
            a => a.notionId === notionId && a.type === 'update-in-obsidian'
          );
          if (!alreadyUpdatingFromNotion) {
            actions.push({
              type: 'update-in-notion',
              notionId,
              path: file.path,
              file,
            });
          }
        }
      }
    } else if (file.database) {
      actions.push({
        type: 'create-in-notion',
        path: file.path,
        file,
      });
    }
  }

  return actions;
}

export function getObsidianPathForPage(page: NotionPage, type?: string): string {
  const folder = DATABASE_FOLDERS[page.database];

  if (page.database === 'ressources' && type) {
    const subfolder = TYPE_TO_FOLDER[type] || type;
    return `${folder}/${subfolder}/${page.title}.md`;
  }

  return `${folder}/${page.title}.md`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/sync/engine.ts tests/sync/engine.test.ts && git commit -m "feat: sync engine with create/update/delete action computation"
```

---

### Task 13: Notion → Obsidian Property Mapping

**Files:**
- Create: `src/notion/properties.ts`
- Create: `tests/notion/properties.test.ts`

This module extracts properties from Notion pages into the frontmatter format, and reverses the mapping for Obsidian → Notion.

- [ ] **Step 1: Write failing tests**

Create `tests/notion/properties.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractNotionProperties, extractType } from '../../src/notion/properties.js';

describe('extractNotionProperties', () => {
  it('extracts tache properties', () => {
    const props = {
      Nom: { type: 'title', title: [{ plain_text: 'Build API' }] },
      Status: { type: 'select', select: { name: 'En cours' } },
    };
    const result = extractNotionProperties(props, 'taches');
    expect(result.notion_id).toBeUndefined();
    expect(result.status).toBe('En cours');
  });

  it('extracts ressource properties', () => {
    const props = {
      Nom: { type: 'title', title: [{ plain_text: 'Atomic Habits' }] },
      Type: { type: 'select', select: { name: 'Book' } },
      URL: { type: 'url', url: 'https://example.com' },
      Tags: { type: 'multi_select', multi_select: [{ name: 'productivity' }, { name: 'habits' }] },
      Auteur: { type: 'rich_text', rich_text: [{ plain_text: 'James Clear' }] },
      'Fiction ?': { type: 'checkbox', checkbox: false },
      Rating: { type: 'rich_text', rich_text: [{ plain_text: '4/5' }] },
      Projets: { type: 'relation', relation: [{ id: 'proj-1' }] },
    };
    const pageIndex = new Map([['proj-1', 'SelfFeed']]);

    const result = extractNotionProperties(props, 'ressources', pageIndex);
    expect(result.type).toBe('Book');
    expect(result.url).toBe('https://example.com');
    expect(result.tags).toEqual(['productivity', 'habits']);
    expect(result.auteur).toBe('James Clear');
    expect(result.fiction).toBe(false);
    expect(result.rating).toBe('4/5');
    expect(result.projets).toEqual(['[[SelfFeed]]']);
  });

  it('extracts projet properties', () => {
    const props = {
      Nom: { type: 'title', title: [{ plain_text: 'SelfFeed' }] },
      Sélection: { type: 'select', select: { name: 'Doing' } },
      Deadline: { type: 'date', date: { start: '2024-09-01' } },
      Areas: { type: 'relation', relation: [{ id: 'area-1' }] },
    };
    const pageIndex = new Map([['area-1', 'Saas']]);

    const result = extractNotionProperties(props, 'projets', pageIndex);
    expect(result.selection).toBe('Doing');
    expect(result.deadline).toBe('2024-09-01');
    expect(result.areas).toEqual(['[[Saas]]']);
  });

  it('extracts area properties', () => {
    const props = {
      Nom: { type: 'title', title: [{ plain_text: 'Saas' }] },
      Date: { type: 'date', date: { start: '2024-08-02' } },
    };
    const result = extractNotionProperties(props, 'areas');
    expect(result.date).toBe('2024-08-02');
  });
});

describe('extractType', () => {
  it('extracts Type select from properties', () => {
    const props = {
      Type: { type: 'select', select: { name: 'Recette' } },
    };
    expect(extractType(props)).toBe('Recette');
  });

  it('returns undefined when no Type property', () => {
    expect(extractType({})).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/notion/properties.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement src/notion/properties.ts**

```typescript
import { DatabaseType } from '../types.js';
import { resolveNotionRelations } from '../sync/relations.js';

export function extractNotionProperties(
  properties: Record<string, any>,
  database: DatabaseType,
  pageIndex?: Map<string, string>
): Record<string, any> {
  const relations = resolveNotionRelations(properties, pageIndex ?? new Map());
  const result: Record<string, any> = {};

  const commonKeys = ['status', 'selection', 'deadline', 'date_creation', 'derniere_modification'];
  const relationKeys = ['areas', 'projets', 'ressources', 'taches', 'ressources_liees'];

  for (const [key, val] of Object.entries(relations)) {
    result[key.toLowerCase().replace(/ /g, '_')] = val;
  }

  if (database === 'taches') {
    if (properties.Status?.select?.name) result.status = properties.Status.select.name;
  }

  if (database === 'projets') {
    if (properties.Sélection?.select?.name) result.selection = properties.Sélection.select.name;
    if (properties.Deadline?.date?.start) result.deadline = properties.Deadline.date.start;
    if (properties['Date de création']?.date?.start) result.date_creation = properties['Date de création'].date.start;
    if (properties['Dernière modification']?.date?.start) result.derniere_modification = properties['Dernière modification'].date.start;
  }

  if (database === 'areas') {
    if (properties.Date?.date?.start) result.date = properties.Date.date.start;
  }

  if (database === 'ressources') {
    if (properties.Type?.select?.name) result.type = properties.Type.select.name;
    if (properties.URL?.url) result.url = properties.URL.url;
    if (properties.Tags?.multi_select) result.tags = properties.Tags.multi_select.map((t: any) => t.name);
    if (properties.Auteur?.rich_text) result.auteur = properties.Auteur.rich_text.map((r: any) => r.plain_text).join('');
    if (properties.Commencé?.date?.start) result.commence = properties.Commencé.date.start;
    if (properties['Fiction ?'] !== undefined) result.fiction = properties['Fiction ?'].checkbox;
    if (properties.Genres?.multi_select) result.genres = properties.Genres.multi_select.map((g: any) => g.name);
    if (properties.Lecture?.select?.name) result.lecture = properties.Lecture.select.name;
    if (properties.Notes?.rich_text) result.notes = properties.Notes.rich_text.map((r: any) => r.plain_text).join('');
    if (properties.Rating?.rich_text) result.rating = properties.Rating.rich_text.map((r: any) => r.plain_text).join('');
    if (properties.Terminé?.date?.start) result.termine = properties.Terminé.date.start;
  }

  for (const rk of relationKeys) {
    const propKey = rk.charAt(0).toUpperCase() + rk.slice(1);
    if (properties[propKey]?.type === 'relation') {
      const ids = properties[propKey].relation.map((r: any) => r.id);
      const index = pageIndex ?? new Map();
      const wikilinks = ids.map((id: string) => index.get(id)).filter(Boolean).map((t: string) => `[[${t}]]`);
      if (wikilinks.length) result[rk] = wikilinks;
    }
  }

  if (database === 'ressources' && properties['Ressources liée']?.type === 'relation') {
    const ids = properties['Ressources liée'].relation.map((r: any) => r.id);
    const index = pageIndex ?? new Map();
    const wikilinks = ids.map((id: string) => index.get(id)).filter(Boolean).map((t: string) => `[[${t}]]`);
    if (wikilinks.length) result.ressources_liees = wikilinks;
  }

  return result;
}

export function extractType(properties: Record<string, any>): string | undefined {
  return properties.Type?.select?.name;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/notion/properties.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/notion/properties.ts tests/notion/properties.test.ts && git commit -m "feat: Notion property extraction and mapping to frontmatter fields"
```

---

### Task 14: Entry Point & Sync Orchestration

**Files:**
- Create: `src/index.ts`
- Modify: `src/sync/engine.ts` (add executeSync function)

- [ ] **Step 1: Add executeSync to src/sync/engine.ts**

Add this function to the existing `engine.ts` file. It orchestrates the full sync using all modules:

```typescript
import { getNotionClient } from '../notion/client.js';
import { fetchAllDatabases } from '../notion/fetch.js';
import { createNotionPage, updateNotionPage } from '../notion/push.js';
import { notionToMarkdown } from '../notion/converter.js';
import { extractNotionProperties, extractType } from '../notion/properties.js';
import { scanVault } from '../obsidian/reader.js';
import { writeObsidianFile, deleteObsidianFile } from '../obsidian/writer.js';
import { generateFrontmatter, buildFileContent } from '../obsidian/frontmatter.js';
import { buildPageIndex, resolveObsidianRelations } from './relations.js';
import { loadState, saveState, setPageState } from './state.js';
import { SyncConfig, NotionPage, ObsidianFile, SyncResult, SyncError, PageState } from '../types.js';

export async function executeSync(config: SyncConfig): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, skipped: 0, errors: [] };

  const state = await loadState();
  const client = getNotionClient(config.notionApiKey);

  console.log('Fetching Notion pages...');
  const notionPages = await fetchAllDatabases(client, config.notionDatabases);
  console.log(`Found ${notionPages.length} Notion pages`);

  const pageIndex = buildPageIndex(notionPages);

  console.log('Scanning Obsidian vault...');
  const obsidianFiles = await scanVault(config.obsidianVaultPath);
  console.log(`Found ${obsidianFiles.length} Obsidian files`);

  const actions = computeSyncActions(notionPages, obsidianFiles, state);
  console.log(`Computed ${actions.length} sync actions`);

  const resolveWikilink = (title: string) => {
    const page = Object.values(state.pages).find(
      p => p.title.toLowerCase() === title.toLowerCase()
    );
    return page?.notionId;
  };

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create-in-obsidian': {
          const page = action.page;
          const type = page.database === 'ressources' ? extractType(page.properties) : undefined;
          const fm = extractNotionProperties(page.properties, page.database, pageIndex);
          fm.notion_id = page.id;
          fm.database = page.database;
          const body = notionToMarkdown(page.blocks);
          const obsPath = getObsidianPathForPage(page, type);

          await writeObsidianFile(config.obsidianVaultPath, {
            path: obsPath,
            frontmatter: fm,
            content: body,
            database: page.database,
          });

          const now = new Date().toISOString();
          state.pages[page.id] = {
            notionId: page.id,
            title: page.title,
            database: page.database,
            obsidianPath: obsPath,
            lastNotionEdit: page.lastEditedTime,
            lastObsidianEdit: now,
            lastSync: now,
            deleted: false,
          };

          result.created++;
          console.log(`  Created: ${obsPath}`);
          break;
        }

        case 'update-in-obsidian': {
          const page = action.page;
          const type = page.database === 'ressources' ? extractType(page.properties) : undefined;
          const existingState = state.pages[page.id];
          const fm = extractNotionProperties(page.properties, page.database, pageIndex);
          fm.notion_id = page.id;
          fm.database = page.database;
          const body = notionToMarkdown(page.blocks);
          const obsPath = getObsidianPathForPage(page, type);

          await writeObsidianFile(config.obsidianVaultPath, {
            path: obsPath,
            frontmatter: fm,
            content: body,
            database: page.database,
          });

          const now = new Date().toISOString();
          state.pages[page.id] = {
            ...existingState,
            notionId: page.id,
            title: page.title,
            database: page.database,
            obsidianPath: obsPath,
            lastNotionEdit: page.lastEditedTime,
            lastObsidianEdit: now,
            lastSync: now,
          };

          result.updated++;
          console.log(`  Updated: ${obsPath}`);
          break;
        }

        case 'create-in-notion': {
          const file = action.file;
          const pageId = await createNotionPage(client, file, config, resolveWikilink);

          const now = new Date().toISOString();
          state.pages[pageId] = {
            notionId: pageId,
            title: path.basename(file.path, '.md'),
            database: file.database!,
            obsidianPath: file.path,
            lastNotionEdit: now,
            lastObsidianEdit: now,
            lastSync: now,
            deleted: false,
          };

          file.frontmatter.notion_id = pageId;
          await writeObsidianFile(config.obsidianVaultPath, file);

          result.created++;
          console.log(`  Created in Notion: ${file.path} → ${pageId}`);
          break;
        }

        case 'update-in-notion': {
          const file = action.file;
          await updateNotionPage(client, action.notionId, file, file.database!, resolveWikilink);

          const now = new Date().toISOString();
          if (state.pages[action.notionId]) {
            state.pages[action.notionId].lastNotionEdit = now;
            state.pages[action.notionId].lastSync = now;
          }

          result.updated++;
          console.log(`  Updated in Notion: ${file.path}`);
          break;
        }

        case 'delete-in-obsidian': {
          await deleteObsidianFile(config.obsidianVaultPath, action.obsidianPath);
          if (state.pages[action.notionId]) {
            state.pages[action.notionId].deleted = true;
          }
          result.deleted++;
          console.log(`  Deleted: ${action.obsidianPath}`);
          break;
        }
      }
    } catch (error: any) {
      result.errors.push({
        notionId: action.notionId,
        path: 'path' in action ? action.path : undefined,
        message: error.message,
        phase: action.type.includes('obsidian') ? 'notion-to-obsidian' : 'obsidian-to-notion',
      });
      console.error(`  Error: ${error.message}`);
    }
  }

  state.lastSync = new Date().toISOString();
  await saveState(state);

  return result;
}
```

Note: add `import path from 'path';` to the imports at the top of the file.

- [ ] **Step 2: Implement src/index.ts**

```typescript
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { executeSync } from './sync/engine.js';

async function main() {
  console.log(chalk.blue('Notion ↔ Obsidian Sync'));
  console.log(chalk.gray('─'.repeat(30)));

  try {
    const config = await loadConfig();
    const result = await executeSync(config);

    console.log(chalk.gray('─'.repeat(30)));
    console.log(chalk.green(`Created: ${result.created}`));
    console.log(chalk.yellow(`Updated: ${result.updated}`));
    console.log(chalk.red(`Deleted: ${result.deleted}`));
    console.log(chalk.gray(`Skipped: ${result.skipped}`));

    if (result.errors.length) {
      console.log(chalk.red(`\nErrors (${result.errors.length}):`));
      for (const err of result.errors) {
        console.log(chalk.red(`  - ${err.phase}: ${err.message}`));
      }
    }

    console.log(chalk.gray('─'.repeat(30)));
    console.log(chalk.green('Sync complete!'));
  } catch (error: any) {
    console.error(chalk.red('Sync failed:'), error.message);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors (fix any import issues)

- [ ] **Step 4: Commit**

```bash
git add src/index.ts src/sync/engine.ts && git commit -m "feat: sync orchestration entry point with full bidirectional flow"
```

---

### Task 15: Integration Test (Smoke Test)

**Files:**
- Create: `tests/e2e.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/e2e.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { computeSyncActions, getObsidianPathForPage } from '../src/sync/engine.js';
import { notionToMarkdown, markdownToNotionBlocks } from '../src/notion/converter.js';
import { parseFrontmatter, generateFrontmatter } from '../src/obsidian/frontmatter.js';
import { buildPageIndex, resolveNotionRelations, notionIdsToWikilinks } from '../src/sync/relations.js';
import { NotionPage, SyncState } from '../src/types.js';

describe('end-to-end sync flow', () => {
  it('syncs a new Notion page to Obsidian', () => {
    const notionPage: NotionPage = {
      id: 'task-1',
      database: 'taches',
      title: 'Build sync tool',
      properties: {
        Nom: { type: 'title', title: [{ plain_text: 'Build sync tool' }] },
        Status: { type: 'select', select: { name: 'En cours' } },
      },
      lastEditedTime: '2026-04-29T12:00:00Z',
      createdTime: '2026-04-29T12:00:00Z',
      blocks: [
        { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Implement bidirectional sync', type: 'text', text: { content: 'Implement bidirectional sync' } }] } },
        { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Write converter', type: 'text', text: { content: 'Write converter' } }], checked: true } },
        { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Write engine', type: 'text', text: { content: 'Write engine' } }], checked: false } },
      ],
      archived: false,
    };

    const state: SyncState = { lastSync: '', pages: {} };
    const actions = computeSyncActions([notionPage], [], state);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('create-in-obsidian');

    const obsPath = getObsidianPathForPage(notionPage);
    expect(obsPath).toBe('Tâches/Build sync tool.md');

    const body = notionToMarkdown(notionPage.blocks);
    expect(body).toContain('Implement bidirectional sync');
    expect(body).toContain('- [x] Write converter');
    expect(body).toContain('- [ ] Write engine');
  });

  it('roundtrips markdown through Notion blocks', () => {
    const original = '# Title\n\nHello **world**\n\n- Item 1\n- Item 2\n\n```ts\nconst x = 1;\n```';
    const blocks = markdownToNotionBlocks(original);
    expect(blocks.length).toBeGreaterThan(0);

    const back = notionToMarkdown(blocks);
    expect(back).toContain('# Title');
    expect(back).toContain('- Item 1');
    expect(back).toContain('```ts');
  });

  it('resolves relations across databases', () => {
    const pages: NotionPage[] = [
      { id: 'proj-1', database: 'projets', title: 'SelfFeed', properties: {}, lastEditedTime: '', createdTime: '', blocks: [], archived: false },
      { id: 'area-1', database: 'areas', title: 'Saas', properties: {}, lastEditedTime: '', createdTime: '', blocks: [], archived: false },
    ];
    const index = buildPageIndex(pages);

    const wikilinks = notionIdsToWikilinks(['proj-1', 'area-1'], index);
    expect(wikilinks).toEqual(['[[SelfFeed]]', '[[Saas]]']);

    const fm = generateFrontmatter({
      notion_id: 'r1',
      database: 'ressources',
      projets: wikilinks,
    });
    expect(fm).toContain('[[SelfFeed]]');
    expect(fm).toContain('[[Saas]]');

    const parsed = parseFrontmatter(fm + '\n\nBody');
    expect(parsed.frontmatter.projets).toEqual(['[[SelfFeed]]', '[[Saas]]']);
    expect(parsed.content).toBe('Body');
  });

  it('detects conflicts with last-modified-wins', () => {
    const state: SyncState = {
      lastSync: '2026-04-29T10:00:00Z',
      pages: {
        'p1': {
          notionId: 'p1',
          title: 'Task',
          database: 'taches',
          obsidianPath: 'Tâches/Task.md',
          lastNotionEdit: '2026-04-29T09:00:00Z',
          lastObsidianEdit: '2026-04-29T09:00:00Z',
          lastSync: '2026-04-29T10:00:00Z',
          deleted: false,
        },
      },
    };

    const newerNotion: NotionPage[] = [
      {
        id: 'p1',
        database: 'taches',
        title: 'Task',
        properties: {},
        lastEditedTime: '2026-04-29T11:00:00Z',
        createdTime: '',
        blocks: [],
        archived: false,
      },
    ];

    const actions = computeSyncActions(newerNotion, [], state);
    expect(actions.find(a => a.type === 'update-in-obsidian')).toBeDefined();
    expect(actions.find(a => a.type === 'update-in-notion')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/e2e.test.ts`
Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/e2e.test.ts && git commit -m "test: end-to-end integration tests for sync flow"
```

---

### Task 16: Manual Smoke Test

- [ ] **Step 1: Set up real .env**

Create `.env` with the real Notion API key:
```
NOTION_API_KEY=<your-notion-api-key>
```

- [ ] **Step 2: Ensure vault directory exists**

Verify that the path configured in `config.yaml` (`../../obsidian` relative to project root) points to an existing directory. If not, create it or adjust the config.

- [ ] **Step 3: Run sync**

Run: `npm run sync`
Expected: Fetches from Notion, creates Obsidian files, outputs summary.

- [ ] **Step 4: Verify Obsidian vault**

Check that files were created in the vault:
- `Areas/*.md` — one file per area
- `Projets/*.md` — one file per project
- `Tâches/*.md` — one file per task
- `Ressources/<type>/*.md` — resources organized by type

- [ ] **Step 5: Run sync again (idempotency check)**

Run: `npm run sync`
Expected: All items skipped (no creates/updates/deletes).

- [ ] **Step 6: Final commit**

```bash
git add -A && git commit -m "feat: complete bidirectional Notion-Obsidian sync tool"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| TypeScript/Node.js | Task 1 |
| Config via .env + config.yaml | Task 3 |
| 4 Notion databases | Task 6 |
| Notion → Markdown conversion | Task 7 |
| Markdown → Notion conversion | Task 7 |
| Frontmatter YAML (notion_id) | Task 9 |
| sync-state.json | Task 4 |
| Rate limiting + retry | Task 5 |
| Obsidian vault scanning | Task 10 |
| File writing with folders | Task 10 |
| Relation resolution (ID ↔ wikilink) | Task 11 |
| Sync engine (create/update/delete) | Task 12 |
| Property mapping | Task 13 |
| Entry point orchestration | Task 14 |
| Type → folder mapping | Task 2 (constants) |
| Deletion handling | Task 12 (delete-in-obsidian) |
| Error handling | Task 14 (try/catch in executeSync) |
| `npm run sync` command | Task 1 (package.json) |
| chalk output | Task 14 |

### Placeholder Scan

No TBD, TODO, or placeholder patterns found.

### Type Consistency

All types defined in `src/types.ts` and used consistently across modules. Function signatures match between definition and call sites.

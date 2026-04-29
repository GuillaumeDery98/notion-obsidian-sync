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

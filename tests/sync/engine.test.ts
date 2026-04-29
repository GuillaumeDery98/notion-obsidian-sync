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
    if (del && del.type === 'delete-in-obsidian') {
      expect(del.obsidianPath).toBe('Tâches/Test.md');
    }
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
    const relevant = actions.filter(a => {
      if ('notionId' in a) return a.notionId === 'p1';
      return false;
    });
    expect(relevant).toHaveLength(0);
  });
});

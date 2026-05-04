import { describe, it, expect } from 'vitest';
import { computeSyncActions, getObsidianPathForPage } from '../src/sync/engine.js';
import { notionToMarkdown, markdownToNotionBlocks } from '../src/notion/converter.js';
import { parseFrontmatter, generateFrontmatter } from '../src/obsidian/frontmatter.js';
import { buildPageIndex, notionIdsToWikilinks } from '../src/sync/relations.js';
import { NotionPage, SyncState } from '../src/types.js';

describe('end-to-end sync flow', () => {
  it('syncs a new Notion page to Obsidian', async () => {
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
    const actions = await computeSyncActions([notionPage], [], state, '/tmp/vault');
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('create-in-obsidian');

    const obsPath = getObsidianPathForPage(notionPage);
    expect(obsPath).toBe('PARA/Tâches/Build sync tool.md');

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

  it('detects conflicts with last-modified-wins', async () => {
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

    const actions = await computeSyncActions(newerNotion, [], state, '/tmp/vault');
    expect(actions.find(a => a.type === 'update-in-obsidian')).toBeDefined();
    expect(actions.find(a => a.type === 'update-in-notion')).toBeUndefined();
  });
});

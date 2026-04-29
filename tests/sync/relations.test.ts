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
    ];
    const index = buildPageIndex(pages);
    expect(index.get('id-1')).toBe('SelfFeed');
    expect(index.get('id-2')).toBe('Saas');
    expect(index.get('id-4')).toBeUndefined();
  });
});

describe('notionIdsToWikilinks', () => {
  it('converts array of Notion IDs to wikilink strings', () => {
    const index = new Map([['id-1', 'SelfFeed'], ['id-2', 'Saas']]);
    const result = notionIdsToWikilinks(['id-1', 'id-2', 'id-unknown'], index);
    expect(result).toEqual(['[[SelfFeed]]', '[[Saas]]']);
  });

  it('returns empty array for null/undefined', () => {
    expect(notionIdsToWikilinks(null, new Map())).toEqual([]);
  });
});

describe('wikilinksToTitles', () => {
  it('extracts titles from wikilink arrays', () => {
    expect(wikilinksToTitles(['[[SelfFeed]]', '[[Saas]]'])).toEqual(['SelfFeed', 'Saas']);
  });
});

describe('resolveNotionRelations', () => {
  it('converts Notion relation IDs to wikilinks', () => {
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
  it('resolves wikilink titles to Notion IDs', () => {
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

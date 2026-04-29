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

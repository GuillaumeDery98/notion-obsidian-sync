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

  it('builds ressource properties with type and tags', () => {
    const file: ObsidianFile = {
      path: 'Ressources/Recettes/Poulet.md',
      frontmatter: {
        database: 'ressources',
        notion_id: 'r1',
        type: 'Recette',
        url: 'https://example.com',
        tags: ['tag1', 'tag2'],
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
        delete: mockDelete,
        children: {
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

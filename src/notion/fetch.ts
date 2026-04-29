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

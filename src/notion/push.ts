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
    .filter((v): v is string => v !== null);

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

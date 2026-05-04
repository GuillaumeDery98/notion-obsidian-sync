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
      continue;
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
    } else if (prop.type === 'status' && prop.status) {
      result[key] = prop.status.name;
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

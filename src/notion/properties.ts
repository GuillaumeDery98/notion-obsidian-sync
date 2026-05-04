import { DatabaseType } from '../types.js';
import { resolveNotionRelations } from '../sync/relations.js';

export function extractNotionProperties(
  properties: Record<string, any>,
  database: DatabaseType,
  pageIndex?: Map<string, string>
): Record<string, any> {
  const relations = resolveNotionRelations(properties, pageIndex ?? new Map());
  const result: Record<string, any> = {};

  for (const [key, val] of Object.entries(relations)) {
    result[key.toLowerCase().replace(/ /g, '_')] = val;
  }

  if (database === 'taches') {
    if (properties.Status?.status?.name) result.status = properties.Status.status.name;
    else if (properties.Status?.select?.name) result.status = properties.Status.select.name;
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

  const relationKeys = ['areas', 'projets', 'ressources', 'taches', 'ressources_liees'];
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

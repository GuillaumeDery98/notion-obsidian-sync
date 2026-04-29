import {
  NotionPage,
  ObsidianFile,
  SyncState,
  DatabaseType,
  TYPE_TO_FOLDER,
  DATABASE_FOLDERS,
} from '../types.js';

export type SyncAction =
  | { type: 'create-in-obsidian'; notionId: string; page: NotionPage }
  | { type: 'update-in-obsidian'; notionId: string; page: NotionPage; obsidianPath: string }
  | { type: 'create-in-notion'; path: string; file: ObsidianFile }
  | { type: 'update-in-notion'; notionId: string; path: string; file: ObsidianFile }
  | { type: 'delete-in-obsidian'; notionId: string; obsidianPath: string }
  | { type: 'archive-in-notion'; notionId: string };

export function computeSyncActions(
  notionPages: NotionPage[],
  obsidianFiles: ObsidianFile[],
  state: SyncState
): SyncAction[] {
  const actions: SyncAction[] = [];
  const lastSync = state.lastSync;
  const syncedNotionIds = new Set<string>();

  for (const page of notionPages) {
    syncedNotionIds.add(page.id);
    const pageState = state.pages[page.id];

    if (!pageState) {
      actions.push({ type: 'create-in-obsidian', notionId: page.id, page });
      continue;
    }

    if (page.lastEditedTime > pageState.lastNotionEdit) {
      actions.push({
        type: 'update-in-obsidian',
        notionId: page.id,
        page,
        obsidianPath: pageState.obsidianPath,
      });
    }
  }

  for (const [notionId, pageState] of Object.entries(state.pages)) {
    if (pageState.deleted) continue;
    if (!syncedNotionIds.has(notionId)) {
      actions.push({
        type: 'delete-in-obsidian',
        notionId,
        obsidianPath: pageState.obsidianPath,
      });
    }
  }

  for (const file of obsidianFiles) {
    const notionId = file.frontmatter?.notion_id as string | undefined;

    if (notionId) {
      const pageState = state.pages[notionId];
      if (pageState && lastSync) {
        const obsidianMtime = file.frontmatter?.derniere_modification as string | undefined;
        if (!obsidianMtime || obsidianMtime > pageState.lastSync) {
          const alreadyUpdatingFromNotion = actions.some(a => {
            if (a.type !== 'update-in-obsidian') return false;
            return a.notionId === notionId;
          });
          if (!alreadyUpdatingFromNotion) {
            actions.push({
              type: 'update-in-notion',
              notionId,
              path: file.path,
              file,
            });
          }
        }
      }
    } else if (file.database) {
      actions.push({
        type: 'create-in-notion',
        path: file.path,
        file,
      });
    }
  }

  return actions;
}

export function getObsidianPathForPage(page: NotionPage, type?: string): string {
  const folder = DATABASE_FOLDERS[page.database];

  if (page.database === 'ressources' && type) {
    const subfolder = TYPE_TO_FOLDER[type] || type;
    return `${folder}/${subfolder}/${page.title}.md`;
  }

  return `${folder}/${page.title}.md`;
}

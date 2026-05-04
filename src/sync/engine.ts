import path from 'path';
import fs from 'fs/promises';
import {
  NotionPage,
  ObsidianFile,
  SyncState,
  PageState,
  DatabaseType,
  SyncConfig,
  SyncResult,
  SyncError,
  TYPE_TO_FOLDER,
  DATABASE_FOLDERS,
  STATUS_FOLDERS,
} from '../types.js';
import { getNotionClient } from '../notion/client.js';
import { fetchAllDatabases } from '../notion/fetch.js';
import { createNotionPage, updateNotionPage } from '../notion/push.js';
import { notionToMarkdown } from '../notion/converter.js';
import { extractNotionProperties, extractType } from '../notion/properties.js';
import { scanVault } from '../obsidian/reader.js';
import { writeObsidianFile, deleteObsidianFile } from '../obsidian/writer.js';
import { buildPageIndex, resolveObsidianRelations } from './relations.js';
import { loadState, saveState } from './state.js';
import {
  extractFileUrlsFromBlocks,
  extractFileUrlsFromProperties,
  downloadPageFiles,
  replaceFileUrlsInContent,
  replaceFileUrlsInFrontmatter,
} from './files.js';

export type SyncAction =
  | { type: 'create-in-obsidian'; notionId: string; page: NotionPage }
  | { type: 'update-in-obsidian'; notionId: string; page: NotionPage; obsidianPath: string }
  | { type: 'create-in-notion'; path: string; file: ObsidianFile }
  | { type: 'update-in-notion'; notionId: string; path: string; file: ObsidianFile }
  | { type: 'delete-in-obsidian'; notionId: string; obsidianPath: string }
  | { type: 'archive-in-notion'; notionId: string };

export async function computeSyncActions(
  notionPages: NotionPage[],
  obsidianFiles: ObsidianFile[],
  state: SyncState,
  vaultPath: string
): Promise<SyncAction[]> {
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
        if (file.path !== pageState.obsidianPath) {
          pageState.obsidianPath = file.path;
        }

        const fmTime = file.frontmatter?.derniere_modification as string | undefined;
        let modified = false;

        if (fmTime) {
          modified = fmTime > pageState.lastSync;
        } else {
          try {
            const stat = await fs.stat(path.join(vaultPath, file.path));
            modified = stat.mtime.toISOString() > pageState.lastSync;
          } catch {
            modified = true;
          }
        }

        if (modified) {
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

function detectStatusFromPath(filePath: string): string | undefined {
  const parts = filePath.split('/');
  const tachesIdx = parts.indexOf('Tâches');
  if (tachesIdx === -1 || tachesIdx + 1 >= parts.length) return undefined;
  const subfolder = parts[tachesIdx + 1];
  if (STATUS_FOLDERS[subfolder]) return subfolder;
  return undefined;
}
const MAX_FILENAME_LENGTH = 80;

function truncateTitle(title: string): string {
  const sanitized = title.replace(/[\/\\:*?"<>|]/g, '_');
  if (sanitized.length <= MAX_FILENAME_LENGTH) return sanitized;
  return sanitized.substring(0, MAX_FILENAME_LENGTH).trimEnd();
}

export function getObsidianPathForPage(page: NotionPage, type?: string, status?: string): string {
  const folder = DATABASE_FOLDERS[page.database];
  const safeTitle = truncateTitle(page.title);

  if (page.database === 'ressources' && type) {
    const subfolder = TYPE_TO_FOLDER[type] || type;
    return `${folder}/${subfolder}/${safeTitle}.md`;
  }

  if (page.database === 'taches' && status) {
    const statusFolder = STATUS_FOLDERS[status] || status;
    return `${folder}/${statusFolder}/${safeTitle}.md`;
  }

  return `${folder}/${safeTitle}.md`;
}

async function processPageFiles(
  page: NotionPage,
  state: SyncState,
  vaultPath: string,
  frontmatter: Record<string, any>,
  content: string
): Promise<{ frontmatter: Record<string, any>; content: string }> {
  const blockFiles = extractFileUrlsFromBlocks(page.blocks);
  const propFiles = extractFileUrlsFromProperties(page.properties);
  const allFiles = [...blockFiles, ...propFiles];

  if (allFiles.length === 0) {
    return { frontmatter, content };
  }

  const urlMap = await downloadPageFiles(page.id, allFiles, state, vaultPath);

  if (urlMap.size === 0) {
    return { frontmatter, content };
  }

  return {
    frontmatter: replaceFileUrlsInFrontmatter(frontmatter, urlMap),
    content: replaceFileUrlsInContent(content, urlMap),
  };
}

export async function executeSync(config: SyncConfig): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, skipped: 0, errors: [] };

  const state = await loadState();
  const client = getNotionClient(config.notionApiKey);

  console.log('Fetching Notion pages...');
  const notionPages = await fetchAllDatabases(client, config.notionDatabases);
  console.log(`Found ${notionPages.length} Notion pages`);

  const pageIndex = buildPageIndex(notionPages);

  console.log('Scanning Obsidian vault...');
  const obsidianFiles = await scanVault(config.obsidianVaultPath);
  console.log(`Found ${obsidianFiles.length} Obsidian files`);

  const actions = await computeSyncActions(notionPages, obsidianFiles, state, config.obsidianVaultPath);
  console.log(`Computed ${actions.length} sync actions`);

  const resolveWikilink = (title: string) => {
    const page = Object.values(state.pages).find(
      p => p.title.toLowerCase() === title.toLowerCase()
    );
    return page?.notionId;
  };

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create-in-obsidian': {
          const page = action.page;
          const type = page.database === 'ressources' ? extractType(page.properties) : undefined;
          const status = page.database === 'taches' ? (page.properties.Status?.status?.name ?? page.properties.Status?.select?.name) : undefined;
          let fm = extractNotionProperties(page.properties, page.database, pageIndex);
          fm.notion_id = page.id;
          fm.database = page.database;
          fm.title = page.title;
          fm.derniere_modification = page.lastEditedTime;
          let body = notionToMarkdown(page.blocks);
          if (page.title.length > MAX_FILENAME_LENGTH) {
            body = `# ${page.title}\n\n${body}`;
          }

          const processed = await processPageFiles(page, state, config.obsidianVaultPath, fm, body);
          fm = processed.frontmatter;
          body = processed.content;

          const obsPath = getObsidianPathForPage(page, type, status);

          await writeObsidianFile(config.obsidianVaultPath, {
            path: obsPath,
            frontmatter: fm,
            content: body,
            database: page.database,
          });

          const now = new Date().toISOString();
          state.pages[page.id] = {
            notionId: page.id,
            title: page.title,
            database: page.database,
            obsidianPath: obsPath,
            lastNotionEdit: page.lastEditedTime,
            lastObsidianEdit: now,
            lastSync: now,
            deleted: false,
          };

          result.created++;
          console.log(`  Created: ${obsPath}`);
          break;
        }

        case 'update-in-obsidian': {
          const page = action.page;
          const type = page.database === 'ressources' ? extractType(page.properties) : undefined;
          const status = page.database === 'taches' ? (page.properties.Status?.status?.name ?? page.properties.Status?.select?.name) : undefined;
          const existingState = state.pages[page.id];
          let fm = extractNotionProperties(page.properties, page.database, pageIndex);
          fm.notion_id = page.id;
          fm.database = page.database;
          fm.title = page.title;
          fm.derniere_modification = page.lastEditedTime;
          let body = notionToMarkdown(page.blocks);
          if (page.title.length > MAX_FILENAME_LENGTH) {
            body = `# ${page.title}\n\n${body}`;
          }

          const processed = await processPageFiles(page, state, config.obsidianVaultPath, fm, body);
          fm = processed.frontmatter;
          body = processed.content;

          const obsPath = getObsidianPathForPage(page, type, status);

          if (existingState && existingState.obsidianPath !== obsPath) {
            try {
              await deleteObsidianFile(config.obsidianVaultPath, existingState.obsidianPath);
            } catch {
            }
          }

          await writeObsidianFile(config.obsidianVaultPath, {
            path: obsPath,
            frontmatter: fm,
            content: body,
            database: page.database,
          });

          const now = new Date().toISOString();
          state.pages[page.id] = {
            ...existingState,
            notionId: page.id,
            title: page.title,
            database: page.database,
            obsidianPath: obsPath,
            lastNotionEdit: page.lastEditedTime,
            lastObsidianEdit: now,
            lastSync: now,
          };

          result.updated++;
          console.log(`  Updated: ${obsPath}`);
          break;
        }

        case 'create-in-notion': {
          const file = action.file;
          const pageId = await createNotionPage(client, file, config, resolveWikilink);

          const now = new Date().toISOString();
          state.pages[pageId] = {
            notionId: pageId,
            title: path.basename(file.path, '.md'),
            database: file.database!,
            obsidianPath: file.path,
            lastNotionEdit: now,
            lastObsidianEdit: now,
            lastSync: now,
            deleted: false,
          };

          file.frontmatter.notion_id = pageId;
          await writeObsidianFile(config.obsidianVaultPath, file);

          result.created++;
          console.log(`  Created in Notion: ${file.path} → ${pageId}`);
          break;
        }

        case 'update-in-notion': {
          const file = action.file;
          if (file.database === 'taches') {
            const statusFromFolder = detectStatusFromPath(file.path);
            if (statusFromFolder && !file.frontmatter.status) {
              file.frontmatter.status = statusFromFolder;
            }
            if (statusFromFolder && file.frontmatter.status !== statusFromFolder) {
              file.frontmatter.status = statusFromFolder;
            }
          }
          await updateNotionPage(client, action.notionId, file, file.database!, resolveWikilink);

          const now = new Date().toISOString();
          if (state.pages[action.notionId]) {
            state.pages[action.notionId].lastNotionEdit = now;
            state.pages[action.notionId].lastSync = now;
          }

          result.updated++;
          console.log(`  Updated in Notion: ${file.path}`);
          break;
        }

        case 'delete-in-obsidian': {
          await deleteObsidianFile(config.obsidianVaultPath, action.obsidianPath);
          if (state.pages[action.notionId]) {
            state.pages[action.notionId].deleted = true;
          }
          result.deleted++;
          console.log(`  Deleted: ${action.obsidianPath}`);
          break;
        }
      }
    } catch (error: any) {
      result.errors.push({
        notionId: 'notionId' in action ? action.notionId : undefined,
        path: 'path' in action ? action.path : undefined,
        message: error.message,
        phase: action.type.includes('obsidian') ? 'notion-to-obsidian' as const : 'obsidian-to-notion' as const,
      });
      console.error(`  Error: ${error.message}`);
    }
  }

  state.lastSync = new Date().toISOString();
  await saveState(state);

  console.log('Generating MOC notes...');
  const { generateMocNotes } = await import('../obsidian/moc.js');
  await generateMocNotes(config.obsidianVaultPath);

  return result;
}

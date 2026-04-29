import fs from 'fs/promises';
import { SyncState, PageState } from '../types.js';

const STATE_FILE = 'sync-state.json';

export async function loadState(): Promise<SyncState> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastSync: '', pages: {} };
  }
}

export async function saveState(state: SyncState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export function getPageState(state: SyncState, notionId: string): PageState | undefined {
  return state.pages[notionId];
}

export function setPageState(state: SyncState, page: PageState): SyncState {
  return {
    ...state,
    pages: {
      ...state.pages,
      [page.notionId]: page,
    },
  };
}

export function findByTitle(state: SyncState, title: string): PageState | undefined {
  const lower = title.toLowerCase();
  return Object.values(state.pages).find(p => p.title.toLowerCase() === lower);
}

export function findByObsidianPath(state: SyncState, obsidianPath: string): PageState | undefined {
  return Object.values(state.pages).find(p => p.obsidianPath === obsidianPath);
}

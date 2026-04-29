export type DatabaseType = 'areas' | 'projets' | 'taches' | 'ressources';

export interface SyncConfig {
  notionApiKey: string;
  obsidianVaultPath: string;
  notionDatabases: {
    areas: string;
    projets: string;
    taches: string;
    ressources: string;
  };
}

export interface NotionPage {
  id: string;
  database: DatabaseType;
  title: string;
  properties: Record<string, any>;
  lastEditedTime: string;
  createdTime: string;
  blocks: NotionBlock[];
  archived: boolean;
}

export interface NotionBlock {
  type: string;
  id?: string;
  [key: string]: any;
}

export interface ObsidianFile {
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  database?: DatabaseType;
}

export interface SyncState {
  lastSync: string;
  pages: Record<string, PageState>;
}

export interface PageState {
  notionId: string;
  title: string;
  database: DatabaseType;
  obsidianPath: string;
  lastNotionEdit: string;
  lastObsidianEdit: string;
  lastSync: string;
  deleted: boolean;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: SyncError[];
}

export interface SyncError {
  notionId?: string;
  path?: string;
  message: string;
  phase: 'notion-to-obsidian' | 'obsidian-to-notion' | 'deletion';
}

export const DATABASE_FOLDERS: Record<DatabaseType, string> = {
  areas: 'Areas',
  projets: 'Projets',
  taches: 'Tâches',
  ressources: 'Ressources',
};

export const TYPE_TO_FOLDER: Record<string, string> = {
  'Recette': 'Recettes',
  'Book': 'Books',
  'Book note': 'Notes de livre',
  'Business Idea': 'Business Ideas',
  'Business take': 'Business takes',
  'Tool': 'Outils',
  'Article': 'Articles',
  'Training notes': 'Notes de formation',
  'Idea': 'Idées',
  'Film': 'Films',
  'Invest Idea': 'Invest Ideas',
  'Autre': 'Autres',
};

export const FOLDER_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_FOLDER).map(([type, folder]) => [folder, type])
);

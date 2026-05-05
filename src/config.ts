import dotenv from 'dotenv';
import path from 'path';
import { SyncConfig } from './types.js';

dotenv.config();

export function loadConfig(): SyncConfig {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error('NOTION_API_KEY is required in .env');
  }

  const vault = process.env.VAULT;
  if (!vault) {
    throw new Error('VAULT is required in .env');
  }

  const areas = process.env.AREAS;
  const projets = process.env.PROJETS;
  const taches = process.env.TACHES;
  const ressources = process.env.RESSOURCES;

  if (!areas || !projets || !taches || !ressources) {
    throw new Error('AREAS, PROJETS, TACHES, and RESSOURCES are required in .env');
  }

  return {
    notionApiKey: apiKey,
    obsidianVaultPath: path.resolve(process.cwd(), vault),
    notionDatabases: {
      areas,
      projets,
      taches,
      ressources,
    },
  };
}

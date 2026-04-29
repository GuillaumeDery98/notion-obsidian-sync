import dotenv from 'dotenv';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { SyncConfig } from './types.js';

dotenv.config();

export async function loadConfig(): Promise<SyncConfig> {
  const configPath = path.resolve(process.cwd(), 'config.yaml');
  const raw = await fs.readFile(configPath, 'utf-8');
  const parsed = yaml.load(raw) as any;

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error('NOTION_API_KEY is required in .env');
  }

  return {
    notionApiKey: apiKey,
    obsidianVaultPath: path.resolve(process.cwd(), parsed.obsidian.vault_path),
    notionDatabases: parsed.notion.databases,
  };
}

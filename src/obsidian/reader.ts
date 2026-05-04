import fs from 'fs/promises';
import path from 'path';
import { ObsidianFile, DatabaseType, DATABASE_FOLDERS } from '../types.js';
import { parseFrontmatter } from './frontmatter.js';

export async function scanVault(vaultPath: string): Promise<ObsidianFile[]> {
  const files: ObsidianFile[] = [];
  await walkDir(vaultPath, vaultPath, files);
  return files;
}

async function walkDir(dir: string, vaultPath: string, files: ObsidianFile[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '.obsidian' || entry.name === '.trash' || entry.name === 'AI') continue;
      await walkDir(fullPath, vaultPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const raw = await fs.readFile(fullPath, 'utf-8');
      if (raw.includes('moc: true')) continue;
      const relativePath = path.relative(vaultPath, fullPath);
      const file = parseFrontmatter(raw);
      const obsFile: ObsidianFile = {
        path: relativePath,
        frontmatter: file.frontmatter,
        content: file.content,
        database: detectDatabase(relativePath),
      };
      files.push(obsFile);
    }
  }
}

export async function readFile(fullPath: string): Promise<ObsidianFile> {
  const raw = await fs.readFile(fullPath, 'utf-8');
  const parsed = parseFrontmatter(raw);
  return {
    path: fullPath,
    frontmatter: parsed.frontmatter,
    content: parsed.content,
  };
}

function detectDatabase(relativePath: string): DatabaseType | undefined {
  const parts = relativePath.split(path.sep);
  for (const [dbType, folder] of Object.entries(DATABASE_FOLDERS)) {
    const folderParts = folder.split('/');
    if (parts.length >= folderParts.length) {
      const match = folderParts.every((part, i) => parts[i] === part);
      if (match) return dbType as DatabaseType;
    }
  }
  return undefined;
}

import fs from 'fs/promises';
import path from 'path';
import { ObsidianFile } from '../types.js';
import { buildFileContent } from './frontmatter.js';

export async function writeObsidianFile(vaultPath: string, file: ObsidianFile): Promise<void> {
  const fullPath = path.join(vaultPath, file.path);
  const dir = path.dirname(fullPath);

  await fs.mkdir(dir, { recursive: true });

  const content = buildFileContent(file.frontmatter, file.content);
  await fs.writeFile(fullPath, content, 'utf-8');
}

export async function deleteObsidianFile(vaultPath: string, relativePath: string): Promise<void> {
  const fullPath = path.join(vaultPath, relativePath);
  try {
    await fs.unlink(fullPath);
  } catch {
    // already deleted
  }
}

import fs from 'fs/promises';
import path from 'path';
import { DATABASE_FOLDERS } from '../types.js';
import { buildFileContent } from './frontmatter.js';

const FOLDER_MOC_ORDER = ['Areas', 'Projets', 'Ressources', 'Tâches'];

export async function generateMocNotes(vaultPath: string): Promise<void> {
  const folderNames = Object.values(DATABASE_FOLDERS);

  for (const folder of folderNames) {
    const folderPath = path.join(vaultPath, folder);

    if (folder === 'Ressources') {
      const content = await buildRessourcesMocContent(vaultPath);
      await writeMocFile(vaultPath, `${folder}/${folder}.md`, folder, content, { up: '[[PARA]]' });
    } else {
      const children = await collectChildren(folderPath, folder);
      const content = children
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
        .map(name => `- [[${name}]]`)
        .join('\n');
      await writeMocFile(vaultPath, `${folder}/${folder}.md`, folder, content, { up: '[[PARA]]' });
    }
  }

  await generateParaMoc(vaultPath);

  await cleanupSubfolderMocs(vaultPath);
}

async function buildRessourcesMocContent(vaultPath: string): Promise<string> {
  const ressourcesPath = path.join(vaultPath, 'Ressources');
  const sections: string[] = [];

  const subfolders = await getSubfoldersWithFiles(ressourcesPath);

  for (const sub of subfolders) {
    const subPath = path.join(ressourcesPath, sub);
    const files = await collectDirectFiles(subPath, sub);
    if (files.length === 0) continue;

    const sorted = files.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    sections.push(`## ${sub}\n\n${sorted.map(f => `- [[${f}]]`).join('\n')}`);
  }

  const rootFiles = await collectDirectFiles(ressourcesPath, 'Ressources');
  if (rootFiles.length > 0) {
    const sorted = rootFiles.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    sections.push(`## Autres\n\n${sorted.map(f => `- [[${f}]]`).join('\n')}`);
  }

  return sections.join('\n\n');
}

async function getSubfoldersWithFiles(dirPath: string): Promise<string[]> {
  const names: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      names.push(entry.name);
    }
  } catch {
    // ignore
  }
  return names.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

async function collectChildren(
  dirPath: string,
  parentFolder: string
): Promise<string[]> {
  const names: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === `${parentFolder}.md`) continue;
      if (entry.isFile() && entry.name.endsWith('.md')) {
        names.push(path.basename(entry.name, '.md'));
      } else if (entry.isDirectory()) {
        names.push(entry.name);
      }
    }
  } catch {
    // directory doesn't exist yet
  }
  return names;
}

async function collectDirectFiles(
  dirPath: string,
  parentFolder: string
): Promise<string[]> {
  const names: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === `${parentFolder}.md`) continue;
      if (entry.isFile() && entry.name.endsWith('.md')) {
        names.push(path.basename(entry.name, '.md'));
      }
    }
  } catch {
    // directory doesn't exist yet
  }
  return names;
}

async function cleanupSubfolderMocs(vaultPath: string): Promise<void> {
  const ressourcesPath = path.join(vaultPath, 'Ressources');
  try {
    const entries = await fs.readdir(ressourcesPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const mocPath = path.join(ressourcesPath, entry.name, `${entry.name}.md`);
      try {
        await fs.unlink(mocPath);
      } catch {
        // doesn't exist, fine
      }
    }
  } catch {
    // ignore
  }
}

async function generateParaMoc(vaultPath: string): Promise<void> {
  const content = FOLDER_MOC_ORDER
    .map(folder => `- [[${folder}]]`)
    .join('\n');
  await writeMocFile(vaultPath, 'PARA.md', 'PARA', content);
}

async function writeMocFile(
  vaultPath: string,
  relativePath: string,
  title: string,
  content: string,
  extraFrontmatter?: Record<string, any>
): Promise<void> {
  const fullPath = path.join(vaultPath, relativePath);
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });

  const frontmatter: Record<string, any> = {
    moc: true,
    title,
    ...extraFrontmatter,
  };

  const fileContent = buildFileContent(frontmatter, content);
  await fs.writeFile(fullPath, fileContent, 'utf-8');
}

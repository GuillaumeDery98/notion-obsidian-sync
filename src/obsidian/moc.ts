import fs from 'fs/promises';
import path from 'path';
import { DATABASE_FOLDERS, TYPE_TO_FOLDER } from '../types.js';
import { buildFileContent } from './frontmatter.js';

const FOLDER_MOC_ORDER = ['Areas', 'Projets', 'Ressources', 'Tâches'];

export async function generateMocNotes(vaultPath: string): Promise<void> {
  const folderNames = Object.values(DATABASE_FOLDERS);
  const mocLinks: Record<string, string[]> = {};

  for (const folder of folderNames) {
    const folderPath = path.join(vaultPath, folder);
    const children = await collectChildren(folderPath, folder);
    mocLinks[folder] = children;
  }

  await generateSubfolderMocs(vaultPath, 'Ressources');

  for (const [folder, children] of Object.entries(mocLinks)) {
    let content: string;

    if (folder === 'Ressources') {
      content = await buildRessourcesMocContent(vaultPath, children);
    } else {
      content = children
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
        .map(name => `- [[${name}]]`)
        .join('\n');
    }

    await writeMocFile(
      vaultPath,
      `${folder}/${folder}.md`,
      folder,
      content,
      { up: '[[PARA]]' }
    );
  }

  await generateParaMoc(vaultPath);
}

async function buildRessourcesMocContent(
  vaultPath: string,
  directChildren: string[]
): Promise<string> {
  const subfolderLinks = await getSubfolderMocLinks(vaultPath, 'Ressources');
  const subfolderSection = subfolderLinks
    .map(name => `- [[${name}]]`)
    .join('\n');

  const filesSection = directChildren
    .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
    .map(name => `- [[${name}]]`)
    .join('\n');

  const parts: string[] = [];
  if (subfolderSection) parts.push(subfolderSection);
  if (filesSection) parts.push(filesSection);
  return parts.join('\n');
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

async function generateSubfolderMocs(vaultPath: string, parentFolder: string): Promise<void> {
  const parentPath = path.join(vaultPath, parentFolder);

  try {
    const entries = await fs.readdir(parentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const subfolderPath = path.join(parentPath, entry.name);
      const files = await collectDirectFiles(subfolderPath, entry.name);

      if (files.length === 0) continue;

      const content = files
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
        .map(name => `- [[${name}]]`)
        .join('\n');

      await writeMocFile(
        vaultPath,
        `${parentFolder}/${entry.name}/${entry.name}.md`,
        entry.name,
        content,
        { up: `[[${parentFolder}]]` }
      );
    }
  } catch {
    // directory doesn't exist yet
  }
}

async function getSubfolderMocLinks(vaultPath: string, parentFolder: string): Promise<string[]> {
  const parentPath = path.join(vaultPath, parentFolder);
  const links: string[] = [];

  try {
    const entries = await fs.readdir(parentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const subFiles = await fs.readdir(path.join(parentPath, entry.name));
      if (subFiles.some(f => f.endsWith('.md'))) {
        links.push(entry.name);
      }
    }
  } catch {
    // ignore
  }

  return links.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
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

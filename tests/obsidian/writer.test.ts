import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeObsidianFile } from '../../src/obsidian/writer.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('writeObsidianFile', () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-write-'));
  });

  afterEach(async () => {
    await fs.rm(vaultDir, { recursive: true });
  });

  it('writes file with frontmatter to correct path', async () => {
    await writeObsidianFile(vaultDir, {
      path: 'Tâches/My Task.md',
      frontmatter: { notion_id: 't1', database: 'taches', status: 'To Do' },
      content: 'Task body',
      database: 'taches',
    });

    const written = await fs.readFile(path.join(vaultDir, 'Tâches', 'My Task.md'), 'utf-8');
    expect(written).toContain('notion_id: t1');
    expect(written).toContain('status: To Do');
    expect(written).toContain('Task body');
  });

  it('creates subdirectories for ressources', async () => {
    await writeObsidianFile(vaultDir, {
      path: 'Ressources/Recettes/Poulet.md',
      frontmatter: { notion_id: 'r1', database: 'ressources', type: 'Recette' },
      content: 'Recipe',
      database: 'ressources',
    });

    const written = await fs.readFile(path.join(vaultDir, 'Ressources', 'Recettes', 'Poulet.md'), 'utf-8');
    expect(written).toContain('Recipe');
  });

  it('overwrites existing file', async () => {
    const filePath = path.join(vaultDir, 'Test.md');
    await fs.writeFile(filePath, 'old content');

    await writeObsidianFile(vaultDir, {
      path: 'Test.md',
      frontmatter: { notion_id: 'x' },
      content: 'new content',
    });

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toContain('new content');
    expect(written).not.toContain('old content');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanVault, readFile } from '../../src/obsidian/reader.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('scanVault', () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-'));
    await fs.mkdir(path.join(vaultDir, 'PARA', 'Tâches'), { recursive: true });
    await fs.mkdir(path.join(vaultDir, 'PARA', 'Projets'), { recursive: true });
    await fs.mkdir(path.join(vaultDir, 'PARA', 'Ressources', 'Recettes'), { recursive: true });

    await fs.writeFile(
      path.join(vaultDir, 'PARA', 'Tâches', 'Task1.md'),
      '---\nnotion_id: "t1"\ndatabase: taches\nstatus: "To Do"\n---\n\nBody'
    );
    await fs.writeFile(
      path.join(vaultDir, 'PARA', 'Projets', 'SelfFeed.md'),
      '---\nnotion_id: "p1"\ndatabase: projets\n---\n\n# SelfFeed'
    );
    await fs.writeFile(
      path.join(vaultDir, 'PARA', 'Ressources', 'Recettes', 'Poulet.md'),
      '---\nnotion_id: "r1"\ndatabase: ressources\ntype: Recette\n---\n\nRecipe'
    );
    await fs.writeFile(
      path.join(vaultDir, 'PARA', 'Tâches', 'NewTask.md'),
      '---\nstatus: "En cours"\n---\n\nNew task without notion_id'
    );
  });

  afterEach(async () => {
    await fs.rm(vaultDir, { recursive: true });
  });

  it('scans vault and returns all markdown files with parsed frontmatter', async () => {
    const files = await scanVault(vaultDir);
    expect(files.length).toBe(4);
    const withId = files.filter(f => f.frontmatter.notion_id);
    expect(withId.length).toBe(3);
    const withoutId = files.filter(f => !f.frontmatter.notion_id);
    expect(withoutId.length).toBe(1);
    expect(withoutId[0].path).toContain('NewTask.md');
  });

  it('detects database type from folder path', async () => {
    const files = await scanVault(vaultDir);
    const task = files.find(f => f.path.includes('Task1'));
    expect(task?.database).toBe('taches');
    const recette = files.find(f => f.path.includes('Poulet'));
    expect(recette?.database).toBe('ressources');
  });
});

describe('readFile', () => {
  it('reads and parses a single file', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'read-'));
    const filePath = path.join(tmpDir, 'Test.md');
    await fs.writeFile(filePath, '---\nnotion_id: "abc"\n---\n\nContent here');
    const file = await readFile(filePath);
    expect(file.frontmatter.notion_id).toBe('abc');
    expect(file.content).toBe('Content here');
    await fs.rm(tmpDir, { recursive: true });
  });
});

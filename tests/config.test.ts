import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('loadConfig', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(async () => {
    tmpDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'sync-config-')));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    await fs.writeFile(
      path.join(tmpDir, 'config.yaml'),
      [
        'obsidian:',
        '  vault_path: "./vault"',
        'notion:',
        '  databases:',
        '    areas: "area-id"',
        '    projets: "proj-id"',
        '    taches: "task-id"',
        '    ressources: "res-id"',
      ].join('\n')
    );
  });

  afterEach(async () => {
    process.chdir(origCwd);
    await fs.rm(tmpDir, { recursive: true });
  });

  it('loads config from config.yaml and env', async () => {
    process.env.NOTION_API_KEY = 'test-key';
    const config = await loadConfig();
    expect(config.notionApiKey).toBe('test-key');
    expect(config.obsidianVaultPath).toBe(path.resolve(tmpDir, './vault'));
    expect(config.notionDatabases.areas).toBe('area-id');
    expect(config.notionDatabases.ressources).toBe('res-id');
    delete process.env.NOTION_API_KEY;
  });

  it('throws if NOTION_API_KEY is missing', async () => {
    delete process.env.NOTION_API_KEY;
    await expect(loadConfig()).rejects.toThrow('NOTION_API_KEY');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';
import path from 'path';
import os from 'os';

describe('loadConfig', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(async () => {
    tmpDir = await path.realpath(await path.join(os.tmpdir(), 'sync-config-' + Math.random().toString(36).slice(2)));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    process.env.NOTION_API_KEY = 'test-key';
    process.env.VAULT = './vault';
    process.env.AREAS = 'area-id';
    process.env.PROJETS = 'proj-id';
    process.env.TACHES = 'task-id';
    process.env.RESSOURCES = 'res-id';
  });

  afterEach(async () => {
    process.chdir(origCwd);
    delete process.env.NOTION_API_KEY;
    delete process.env.VAULT;
    delete process.env.AREAS;
    delete process.env.PROJETS;
    delete process.env.TACHES;
    delete process.env.RESSOURCES;
  });

  it('loads config from env', () => {
    const config = loadConfig();
    expect(config.notionApiKey).toBe('test-key');
    expect(config.obsidianVaultPath).toBe(path.resolve(tmpDir, './vault'));
    expect(config.notionDatabases.areas).toBe('area-id');
    expect(config.notionDatabases.ressources).toBe('res-id');
  });

  it('throws if NOTION_API_KEY is missing', () => {
    delete process.env.NOTION_API_KEY;
    expect(() => loadConfig()).toThrow('NOTION_API_KEY');
  });

  it('throws if VAULT is missing', () => {
    delete process.env.VAULT;
    expect(() => loadConfig()).toThrow('VAULT');
  });

  it('throws if database env vars are missing', () => {
    delete process.env.AREAS;
    expect(() => loadConfig()).toThrow('AREAS');
  });
});

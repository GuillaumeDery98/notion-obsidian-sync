# File Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download all files attached to Notion pages (property + content blocks) into `PARA/attachments/`, replacing temporary Notion URLs with local paths.

**Architecture:** New `src/sync/files.ts` module handles download + URL replacement. State tracking added to `SyncState.files`. Engine calls file download during create/update-in-obsidian handlers.

**Tech Stack:** Node.js `fetch` (built-in), existing `withRetry` from `notion/client.ts`, `fs` for file writes.

---

## File Structure

- **Create:** `src/sync/files.ts` — download + URL replacement logic
- **Create:** `tests/sync/files.test.ts` — unit tests
- **Modify:** `src/types.ts` — add `FileInfo`, update `SyncState`
- **Modify:** `src/sync/state.ts` — handle `files` in state
- **Modify:** `src/sync/engine.ts` — integrate file download in create/update handlers

---

### Task 1: Add FileInfo type + update SyncState

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add FileInfo interface and update SyncState**

Add after the `SyncError` interface (after line 67):

```typescript
export interface FileInfo {
  notionPageId: string;
  originalUrl: string;
  downloadedAt: string;
}
```

Update the `SyncState` interface (currently lines 38-41):

```typescript
export interface SyncState {
  lastSync: string;
  pages: Record<string, PageState>;
  files: Record<string, FileInfo>;
}
```

- [ ] **Step 2: Update loadState default in state.ts**

In `src/sync/state.ts`, update `loadState` to include `files` default:

```typescript
export async function loadState(): Promise<SyncState> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf-8');
    const state = JSON.parse(raw);
    return { files: {}, ...state };
  } catch {
    return { lastSync: '', pages: {}, files: {} };
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run existing tests**

Run: `npx vitest run`
Expected: all 70 tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/sync/state.ts
git commit -m "feat: add FileInfo type and files tracking to SyncState"
```

---

### Task 2: File download module

**Files:**
- Create: `src/sync/files.ts`
- Create: `tests/sync/files.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sync/files.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { downloadPageFiles, extractFileUrlsFromBlocks, replaceFileUrlsInContent } from '../../src/sync/files.js';

describe('files', () => {
  describe('extractFileUrlsFromBlocks', () => {
    it('extracts image URLs from blocks', () => {
      const blocks = [
        {
          type: 'image',
          image: {
            type: 'file',
            file: { url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc123/image.png' },
            caption: [],
          },
        },
        {
          type: 'paragraph',
          paragraph: { rich_text: [{ plain_text: 'hello' }] },
        },
      ];
      const urls = extractFileUrlsFromBlocks(blocks);
      expect(urls).toEqual([
        { url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc123/image.png', name: 'image.png' },
      ]);
    });

    it('extracts external image URLs', () => {
      const blocks = [
        {
          type: 'image',
          image: {
            type: 'external',
            external: { url: 'https://example.com/photo.jpg' },
            caption: [],
          },
        },
      ];
      const urls = extractFileUrlsFromBlocks(blocks);
      expect(urls).toEqual([
        { url: 'https://example.com/photo.jpg', name: 'photo.jpg' },
      ]);
    });

    it('extracts file and PDF block URLs', () => {
      const blocks = [
        {
          type: 'file',
          file: {
            type: 'file',
            file: { url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/xyz/doc.pdf' },
            caption: [],
          },
        },
        {
          type: 'pdf',
          pdf: {
            type: 'file',
            file: { url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc/report.pdf' },
          },
        },
      ];
      const urls = extractFileUrlsFromBlocks(blocks);
      expect(urls).toHaveLength(2);
      expect(urls[0].name).toBe('doc.pdf');
      expect(urls[1].name).toBe('report.pdf');
    });

    it('extracts video and audio block URLs', () => {
      const blocks = [
        {
          type: 'video',
          video: {
            type: 'file',
            file: { url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/vid/clip.mp4' },
          },
        },
        {
          type: 'audio',
          audio: {
            type: 'file',
            file: { url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/aud/song.mp3' },
          },
        },
      ];
      const urls = extractFileUrlsFromBlocks(blocks);
      expect(urls).toHaveLength(2);
      expect(urls[0].name).toBe('clip.mp4');
      expect(urls[1].name).toBe('song.mp3');
    });

    it('returns empty array for blocks without files', () => {
      const blocks = [
        { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'text' }] } },
      ];
      const urls = extractFileUrlsFromBlocks(blocks);
      expect(urls).toEqual([]);
    });
  });

  describe('replaceFileUrlsInContent', () => {
    it('replaces Notion image URLs with local paths', () => {
      const content = 'Some text\n![caption](https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc/image.png)\nMore text';
      const urlMap = new Map([
        ['https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc/image.png', 'attachments/image_2d153f3a.png'],
      ]);
      const result = replaceFileUrlsInContent(content, urlMap);
      expect(result).toBe('Some text\n![caption](attachments/image_2d153f3a.png)\nMore text');
    });

    it('replaces multiple URLs', () => {
      const content = '![a](https://example.com/a.png)\n![b](https://example.com/b.png)';
      const urlMap = new Map([
        ['https://example.com/a.png', 'attachments/a_2d153f3a.png'],
        ['https://example.com/b.png', 'attachments/b_2d153f3a.png'],
      ]);
      const result = replaceFileUrlsInContent(content, urlMap);
      expect(result).toContain('attachments/a_2d153f3a.png');
      expect(result).toContain('attachments/b_2d153f3a.png');
    });

    it('leaves non-matching URLs unchanged', () => {
      const content = '![x](https://other.com/x.png)';
      const urlMap = new Map();
      const result = replaceFileUrlsInContent(content, urlMap);
      expect(result).toBe(content);
    });
  });

  describe('downloadPageFiles', () => {
    const tmpDir = path.join(process.cwd(), 'test-vault-files');

    beforeEach(async () => {
      await fs.mkdir(tmpDir, { recursive: true });
      try { await fs.rm(path.join(tmpDir, 'PARA', 'attachments'), { recursive: true }); } catch {}
    });

    it('downloads files and returns URL map', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode('fake-png-data').buffer),
      });
      vi.stubGlobal('fetch', mockFetch);

      const notionId = '2d153f3a-8b91-8052-951f-c71f18e980f9';
      const files = [
        { url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc/image.png', name: 'image.png' },
      ];
      const state = { lastSync: '', pages: {}, files: {} };

      const result = await downloadPageFiles(notionId, files, state, tmpDir);

      expect(result.size).toBe(1);
      expect(result.get('https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc/image.png')).toBe('attachments/image_2d153f3a.png');

      vi.restoreAllMocks();
    });

    it('skips already downloaded files', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const notionId = '2d153f3a-8b91-8052-951f-c71f18e980f9';
      const files = [
        { url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc/image.png', name: 'image.png' },
      ];
      const state = {
        lastSync: '',
        pages: {},
        files: {
          'attachments/image_2d153f3a.png': {
            notionPageId: notionId,
            originalUrl: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc/image.png',
            downloadedAt: '2026-05-04T12:00:00.000Z',
          },
        },
      };

      const result = await downloadPageFiles(notionId, files, state, tmpDir);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.size).toBe(1);

      vi.restoreAllMocks();
    });

    it('handles download failure gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });
      vi.stubGlobal('fetch', mockFetch);

      const notionId = '2d153f3a-8b91-8052-951f-c71f18e980f9';
      const files = [
        { url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/abc/image.png', name: 'image.png' },
      ];
      const state = { lastSync: '', pages: {}, files: {} };

      const result = await downloadPageFiles(notionId, files, state, tmpDir);

      expect(result.size).toBe(0);

      vi.restoreAllMocks();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync/files.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/sync/files.ts`**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { FileInfo, SyncState } from '../types.js';

interface FileUrl {
  url: string;
  name: string;
}

export function extractFileUrlsFromBlocks(blocks: any[]): FileUrl[] {
  const files: FileUrl[] = [];

  for (const block of blocks) {
    const type = block.type;
    const data = block[type];
    if (!data) continue;

    const fileTypes = ['image', 'file', 'pdf', 'video', 'audio'];
    if (fileTypes.includes(type)) {
      const url = extractUrlFromBlock(type, data);
      if (url) {
        const name = extractFilename(url, type);
        files.push({ url, name });
      }
    }

    if (data.children?.length) {
      files.push(...extractFileUrlsFromBlocks(data.children));
    }
  }

  return files;
}

function extractUrlFromBlock(type: string, data: any): string | null {
  if (data.type === 'external' && data.external?.url) return data.external.url;
  if (data.type === 'file' && data.file?.url) return data.file.url;
  if (data.url) return data.url;
  return null;
}

function extractFilename(url: string, blockType: string): string {
  try {
    const pathname = new URL(url).pathname;
    const basename = path.basename(pathname);
    if (basename && basename.includes('.')) return decodeURIComponent(basename);
  } catch {}
  const extMap: Record<string, string> = {
    image: '.png',
    file: '.bin',
    pdf: '.pdf',
    video: '.mp4',
    audio: '.mp3',
  };
  return `${blockType}${extMap[blockType] || '.bin'}`;
}

export function extractFileUrlsFromProperties(properties: Record<string, any>): FileUrl[] {
  const files: FileUrl[] = [];

  for (const [, prop] of Object.entries(properties)) {
    if (!prop) continue;
    if (prop.type === 'files' && prop.files?.length) {
      for (const f of prop.files) {
        const url = f.file?.url ?? f.external?.url;
        if (url) {
          const name = f.name ?? extractFilename(url, 'file');
          files.push({ url, name });
        }
      }
    }
  }

  return files;
}

export async function downloadPageFiles(
  notionId: string,
  fileUrls: FileUrl[],
  state: SyncState,
  vaultPath: string
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const shortId = notionId.substring(0, 8);
  const attachmentsDir = path.join(vaultPath, 'PARA', 'attachments');

  await fs.mkdir(attachmentsDir, { recursive: true });

  for (const { url, name } of fileUrls) {
    const safeName = name.replace(/[\/\\:*?"<>|]/g, '_');
    const baseName = path.parse(safeName).name;
    const ext = path.parse(safeName).ext;
    let localName = `${baseName}_${shortId}${ext}`;
    let localPath = `attachments/${localName}`;

    const existing = Object.entries(state.files).find(
      ([, info]) => info.originalUrl === url && info.notionPageId === notionId
    );
    if (existing) {
      urlMap.set(url, existing[0]);
      continue;
    }

    let counter = 2;
    while (state.files[localPath]) {
      localName = `${baseName}_${shortId}_${counter}${ext}`;
      localPath = `attachments/${localName}`;
      counter++;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`  Failed to download ${url}: ${response.statusText}`);
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(path.join(attachmentsDir, localName), buffer);

      state.files[localPath] = {
        notionPageId: notionId,
        originalUrl: url,
        downloadedAt: new Date().toISOString(),
      };

      urlMap.set(url, localPath);
      console.log(`  Downloaded: ${localPath}`);
    } catch (error: any) {
      console.error(`  Error downloading ${url}: ${error.message}`);
    }
  }

  return urlMap;
}

export function replaceFileUrlsInContent(content: string, urlMap: Map<string, string>): string {
  let result = content;
  for (const [originalUrl, localPath] of urlMap) {
    result = result.replaceAll(originalUrl, localPath);
  }
  return result;
}

export function replaceFileUrlsInFrontmatter(frontmatter: Record<string, any>, urlMap: Map<string, string>): Record<string, any> {
  const result = { ...frontmatter };
  for (const [key, val] of Object.entries(result)) {
    if (Array.isArray(val)) {
      result[key] = val.map((item: any) => {
        if (typeof item === 'string') {
          let replaced = item;
          for (const [originalUrl, localPath] of urlMap) {
            replaced = replaced.replaceAll(originalUrl, localPath);
          }
          return replaced;
        }
        return item;
      });
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/sync/files.test.ts`
Expected: all tests pass

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: all tests pass (old 70 + new file tests)

- [ ] **Step 6: Commit**

```bash
git add src/sync/files.ts tests/sync/files.test.ts
git commit -m "feat: file download module with URL extraction and replacement"
```

---

### Task 3: Integrate file download into sync engine

**Files:**
- Modify: `src/sync/engine.ts`

- [ ] **Step 1: Add imports and helper function**

Add at the top of `src/sync/engine.ts`, after the existing imports (after line 24):

```typescript
import {
  extractFileUrlsFromBlocks,
  extractFileUrlsFromProperties,
  downloadPageFiles,
  replaceFileUrlsInContent,
  replaceFileUrlsInFrontmatter,
} from './files.js';
```

- [ ] **Step 2: Add processPageFiles helper**

Add after the `getObsidianPathForPage` function (after line 156):

```typescript
async function processPageFiles(
  page: NotionPage,
  state: SyncState,
  vaultPath: string,
  frontmatter: Record<string, any>,
  content: string
): Promise<{ frontmatter: Record<string, any>; content: string }> {
  const blockFiles = extractFileUrlsFromBlocks(page.blocks);
  const propFiles = extractFileUrlsFromProperties(page.properties);
  const allFiles = [...blockFiles, ...propFiles];

  if (allFiles.length === 0) {
    return { frontmatter, content };
  }

  const urlMap = await downloadPageFiles(page.id, allFiles, state, vaultPath);

  if (urlMap.size === 0) {
    return { frontmatter, content };
  }

  return {
    frontmatter: replaceFileUrlsInFrontmatter(frontmatter, urlMap),
    content: replaceFileUrlsInContent(content, urlMap),
  };
}
```

- [ ] **Step 3: Modify create-in-obsidian handler**

In the `executeSync` function, inside the `create-in-obsidian` case, replace the block that builds frontmatter and content (the lines between `const fm = ...` and `await writeObsidianFile`). The new version wraps frontmatter and content through `processPageFiles`:

Find this section in the `create-in-obsidian` case:

```typescript
          const fm = extractNotionProperties(page.properties, page.database, pageIndex);
          fm.notion_id = page.id;
          fm.database = page.database;
          fm.title = page.title;
          fm.derniere_modification = page.lastEditedTime;
          let body = notionToMarkdown(page.blocks);
          if (page.title.length > MAX_FILENAME_LENGTH) {
            body = `# ${page.title}\n\n${body}`;
          }
          const obsPath = getObsidianPathForPage(page, type, status);

          await writeObsidianFile(config.obsidianVaultPath, {
```

Replace with:

```typescript
          let fm = extractNotionProperties(page.properties, page.database, pageIndex);
          fm.notion_id = page.id;
          fm.database = page.database;
          fm.title = page.title;
          fm.derniere_modification = page.lastEditedTime;
          let body = notionToMarkdown(page.blocks);
          if (page.title.length > MAX_FILENAME_LENGTH) {
            body = `# ${page.title}\n\n${body}`;
          }

          const processed = await processPageFiles(page, state, config.obsidianVaultPath, fm, body);
          fm = processed.frontmatter;
          body = processed.content;

          const obsPath = getObsidianPathForPage(page, type, status);

          await writeObsidianFile(config.obsidianVaultPath, {
```

- [ ] **Step 4: Modify update-in-obsidian handler**

Same change in the `update-in-obsidian` case. Find:

```typescript
          const fm = extractNotionProperties(page.properties, page.database, pageIndex);
          fm.notion_id = page.id;
          fm.database = page.database;
          fm.title = page.title;
          fm.derniere_modification = page.lastEditedTime;
          let body = notionToMarkdown(page.blocks);
          if (page.title.length > MAX_FILENAME_LENGTH) {
            body = `# ${page.title}\n\n${body}`;
          }
          const obsPath = getObsidianPathForPage(page, type, status);

          if (existingState && existingState.obsidianPath !== obsPath) {
```

Replace with:

```typescript
          let fm = extractNotionProperties(page.properties, page.database, pageIndex);
          fm.notion_id = page.id;
          fm.database = page.database;
          fm.title = page.title;
          fm.derniere_modification = page.lastEditedTime;
          let body = notionToMarkdown(page.blocks);
          if (page.title.length > MAX_FILENAME_LENGTH) {
            body = `# ${page.title}\n\n${body}`;
          }

          const processed = await processPageFiles(page, state, config.obsidianVaultPath, fm, body);
          fm = processed.frontmatter;
          body = processed.content;

          const obsPath = getObsidianPathForPage(page, type, status);

          if (existingState && existingState.obsidianPath !== obsPath) {
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/sync/engine.ts
git commit -m "feat: integrate file download into sync engine for create/update flows"
```

---

### Task 4: Smoke test with real sync

**Files:** None (manual testing)

- [ ] **Step 1: Delete sync state and re-sync**

```bash
rm sync-state.json
npm run sync
```

- [ ] **Step 2: Verify attachments folder**

Check that `vault/PARA/attachments/` contains downloaded files from Notion pages that had images or files.

- [ ] **Step 3: Verify content URLs replaced**

Open a note that had an image in Notion. Verify the markdown uses `attachments/filename.ext` instead of a Notion S3 URL.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: file download from Notion to PARA/attachments with local URL replacement"
```

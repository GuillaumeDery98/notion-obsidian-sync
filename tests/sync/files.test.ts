import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractFileUrlsFromBlocks,
  extractFileUrlsFromProperties,
  downloadPageFiles,
  replaceFileUrlsInContent,
  replaceFileUrlsInFrontmatter,
} from '../../src/sync/files.js';
import fs from 'fs/promises';
import path from 'path';
import { SyncState } from '../../src/types.js';

const TEST_VAULT = path.join(process.cwd(), 'test-vault-files');

describe('files', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(TEST_VAULT, { recursive: true }).catch(() => {});
  });

  describe('extractFileUrlsFromBlocks', () => {
    it('extracts image URLs (file type)', () => {
      const blocks = [
        {
          type: 'image',
          image: {
            type: 'file',
            file: { url: 'https://s3.notion.com/image1.png' },
          },
        },
      ];
      expect(extractFileUrlsFromBlocks(blocks)).toEqual(['https://s3.notion.com/image1.png']);
    });

    it('extracts external image URLs', () => {
      const blocks = [
        {
          type: 'image',
          image: {
            type: 'external',
            external: { url: 'https://example.com/photo.jpg' },
          },
        },
      ];
      expect(extractFileUrlsFromBlocks(blocks)).toEqual(['https://example.com/photo.jpg']);
    });

    it('extracts file and PDF block URLs', () => {
      const blocks = [
        {
          type: 'file',
          file: {
            type: 'file',
            file: { url: 'https://s3.notion.com/doc.pdf' },
          },
        },
        {
          type: 'pdf',
          pdf: {
            type: 'file',
            file: { url: 'https://s3.notion.com/report.pdf' },
          },
        },
      ];
      expect(extractFileUrlsFromBlocks(blocks)).toEqual([
        'https://s3.notion.com/doc.pdf',
        'https://s3.notion.com/report.pdf',
      ]);
    });

    it('extracts video and audio block URLs', () => {
      const blocks = [
        {
          type: 'video',
          video: {
            type: 'external',
            external: { url: 'https://youtube.com/watch?v=abc' },
          },
        },
        {
          type: 'audio',
          audio: {
            type: 'file',
            file: { url: 'https://s3.notion.com/audio.mp3' },
          },
        },
      ];
      expect(extractFileUrlsFromBlocks(blocks)).toEqual([
        'https://youtube.com/watch?v=abc',
        'https://s3.notion.com/audio.mp3',
      ]);
    });

    it('extracts URLs from nested children blocks', () => {
      const blocks = [
        {
          type: 'paragraph',
          paragraph: { rich_text: [] },
          children: [
            {
              type: 'image',
              image: {
                type: 'file',
                file: { url: 'https://s3.notion.com/nested.png' },
              },
            },
          ],
        },
      ];
      expect(extractFileUrlsFromBlocks(blocks)).toEqual(['https://s3.notion.com/nested.png']);
    });

    it('returns empty when no file blocks', () => {
      const blocks = [
        { type: 'paragraph', paragraph: { rich_text: [] } },
        { type: 'heading_1', heading_1: { rich_text: [] } },
      ];
      expect(extractFileUrlsFromBlocks(blocks)).toEqual([]);
    });
  });

  describe('replaceFileUrlsInContent', () => {
    it('replaces Notion URLs with local paths', () => {
      const urlMap = new Map([
        ['https://s3.notion.com/image1.png', '/vault/PARA/attachments/image1_abc12345.png'],
      ]);
      const content = '![alt](https://s3.notion.com/image1.png)';
      expect(replaceFileUrlsInContent(content, urlMap)).toBe('![alt](image1_abc12345.png)');
    });

    it('replaces multiple URLs', () => {
      const urlMap = new Map([
        ['https://s3.notion.com/a.png', '/vault/PARA/attachments/a_abc12345.png'],
        ['https://s3.notion.com/b.pdf', '/vault/PARA/attachments/b_abc12345.pdf'],
      ]);
      const content = '![a](https://s3.notion.com/a.png) and [b](https://s3.notion.com/b.pdf)';
      expect(replaceFileUrlsInContent(content, urlMap)).toBe(
        '![a](a_abc12345.png) and [b](b_abc12345.pdf)',
      );
    });

    it('leaves non-matching URLs unchanged', () => {
      const urlMap = new Map([
        ['https://s3.notion.com/image1.png', '/vault/PARA/attachments/image1_abc12345.png'],
      ]);
      const content = '![other](https://example.com/other.png)';
      expect(replaceFileUrlsInContent(content, urlMap)).toBe('![other](https://example.com/other.png)');
    });
  });

  describe('extractFileUrlsFromProperties', () => {
    it('extracts file URLs from files-type property', () => {
      const properties = {
        Cover: {
          type: 'files',
          files: [
            { type: 'file', file: { url: 'https://s3.notion.com/cover.png' } },
            { type: 'external', external: { url: 'https://example.com/icon.svg' } },
          ],
        },
        Title: { type: 'title', title: [] },
      };
      expect(extractFileUrlsFromProperties(properties)).toEqual([
        'https://s3.notion.com/cover.png',
        'https://example.com/icon.svg',
      ]);
    });

    it('returns empty when no file properties', () => {
      const properties = {
        Title: { type: 'title', title: [] },
        Status: { type: 'select', select: { name: 'Done' } },
      };
      expect(extractFileUrlsFromProperties(properties)).toEqual([]);
    });
  });

  describe('replaceFileUrlsInFrontmatter', () => {
    it('replaces URLs in frontmatter array values', () => {
      const urlMap = new Map([
        ['https://s3.notion.com/cover.png', '/vault/PARA/attachments/cover_abc12345.png'],
      ]);
      const frontmatter = {
        tags: ['tag1', 'https://s3.notion.com/cover.png'],
        title: 'My Page',
      };
      const result = replaceFileUrlsInFrontmatter(frontmatter, urlMap);
      expect(result.tags).toEqual(['tag1', 'cover_abc12345.png']);
      expect(result.title).toBe('My Page');
    });

    it('leaves non-array values unchanged', () => {
      const urlMap = new Map([
        ['https://s3.notion.com/cover.png', '/vault/PARA/attachments/cover_abc12345.png'],
      ]);
      const frontmatter = { title: 'My Page', count: 5 };
      const result = replaceFileUrlsInFrontmatter(frontmatter, urlMap);
      expect(result).toEqual({ title: 'My Page', count: 5 });
    });
  });

  describe('downloadPageFiles', () => {
    it('downloads files and returns URL map', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      });
      vi.stubGlobal('fetch', mockFetch);

      const state: SyncState = { lastSync: '', pages: {}, files: {} };
      const notionId = 'abc12345-def6-7890-ghij-klmnopqrstuv';
      const urls = ['https://s3.notion.com/test-image.png'];

      const urlMap = await downloadPageFiles(notionId, urls, state, TEST_VAULT);

      expect(urlMap.size).toBe(1);
      const localPath = urlMap.get('https://s3.notion.com/test-image.png')!;
      expect(localPath).toContain('test-image_abc12345.png');
      expect(state.files[localPath]).toBeDefined();
      expect(state.files[localPath].notionPageId).toBe(notionId);
    });

    it('skips already downloaded files', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const notionId = 'abc12345-def6-7890-ghij-klmnopqrstuv';
      const existingPath = path.join(TEST_VAULT, 'PARA', 'attachments', 'test-image_abc12345.png');
      const state: SyncState = {
        lastSync: '',
        pages: {},
        files: {
          [existingPath]: {
            notionPageId: notionId,
            originalUrl: 'https://s3.notion.com/test-image.png',
            downloadedAt: '2026-01-01T00:00:00Z',
          },
        },
      };

      const urlMap = await downloadPageFiles(
        notionId,
        ['https://s3.notion.com/test-image.png'],
        state,
        TEST_VAULT,
      );

      expect(urlMap.size).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles download failure gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });
      vi.stubGlobal('fetch', mockFetch);

      const state: SyncState = { lastSync: '', pages: {}, files: {} };
      const notionId = 'abc12345-def6-7890-ghij-klmnopqrstuv';

      const urlMap = await downloadPageFiles(
        notionId,
        ['https://s3.notion.com/forbidden.png'],
        state,
        TEST_VAULT,
      );

      expect(urlMap.size).toBe(0);
      expect(Object.keys(state.files).length).toBe(0);
    });

    it('handles filename collision with counter', async () => {
      const callCount = { value: 0 };
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount.value++;
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(4),
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      const attachmentsDir = path.join(TEST_VAULT, 'PARA', 'attachments');
      await fs.mkdir(attachmentsDir, { recursive: true });
      const existingFile = path.join(attachmentsDir, 'photo_abc12345.png');
      await fs.writeFile(existingFile, Buffer.from('existing'));

      const state: SyncState = { lastSync: '', pages: {}, files: {} };
      const notionId = 'abc12345-def6-7890-ghij-klmnopqrstuv';

      const urlMap = await downloadPageFiles(
        notionId,
        ['https://s3.notion.com/photo.png'],
        state,
        TEST_VAULT,
      );

      expect(urlMap.size).toBe(1);
      const localPath = urlMap.get('https://s3.notion.com/photo.png')!;
      expect(localPath).toContain('photo_abc12345_1.png');
      expect(state.files[localPath]).toBeDefined();
    });
  });
});

import path from 'path';
import fs from 'fs/promises';
import { SyncState, FileInfo, NotionBlock } from '../types.js';

const FILE_BLOCK_TYPES = new Set(['image', 'file', 'pdf', 'video', 'audio']);

export function extractFileUrlsFromBlocks(blocks: NotionBlock[]): string[] {
  const urls: string[] = [];

  for (const block of blocks) {
    const blockType = block.type;
    if (FILE_BLOCK_TYPES.has(blockType) && block[blockType]) {
      const data = block[blockType];
      if (data.type === 'file' && data.file?.url) {
        urls.push(data.file.url);
      } else if (data.type === 'external' && data.external?.url) {
        urls.push(data.external.url);
      }
    }

    if (block.children && Array.isArray(block.children)) {
      urls.push(...extractFileUrlsFromBlocks(block.children));
    }
  }

  return urls;
}

export function extractFileUrlsFromProperties(properties: Record<string, any>): string[] {
  const urls: string[] = [];

  for (const prop of Object.values(properties)) {
    if (prop?.type === 'files' && Array.isArray(prop.files)) {
      for (const file of prop.files) {
        if (file.type === 'file' && file.file?.url) {
          urls.push(file.file.url);
        } else if (file.type === 'external' && file.external?.url) {
          urls.push(file.external.url);
        }
      }
    }
  }

  return urls;
}

export async function downloadPageFiles(
  notionId: string,
  fileUrls: string[],
  state: SyncState,
  vaultPath: string,
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const shortId = notionId.substring(0, 8);
  const attachmentsDir = path.join(vaultPath, 'PARA', 'attachments');

  await fs.mkdir(attachmentsDir, { recursive: true });

  for (const url of fileUrls) {
    const existing = Object.entries(state.files).find(
      ([, info]) => info.originalUrl === url && info.notionPageId === notionId,
    );
    if (existing) {
      urlMap.set(url, existing[0]);
      continue;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const urlPath = new URL(url).pathname;
      const basename = path.basename(urlPath, path.extname(urlPath));
      const ext = path.extname(urlPath) || '.bin';
      let filename = `${basename}_${shortId}${ext}`;
      let localPath = path.join(attachmentsDir, filename);
      let counter = 1;

      while (true) {
        try {
          await fs.access(localPath);
          filename = `${basename}_${shortId}_${counter}${ext}`;
          localPath = path.join(attachmentsDir, filename);
          counter++;
        } catch {
          break;
        }
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(localPath, buffer);

      const fileInfo: FileInfo = {
        notionPageId: notionId,
        originalUrl: url,
        downloadedAt: new Date().toISOString(),
      };
      state.files[localPath] = fileInfo;
      urlMap.set(url, localPath);
    } catch {
      continue;
    }
  }

  return urlMap;
}

export function replaceFileUrlsInContent(
  content: string,
  urlMap: Map<string, string>,
): string {
  let result = content;
  for (const [originalUrl, localPath] of urlMap) {
    const filename = path.basename(localPath);
    result = result.replaceAll(originalUrl, filename);
  }
  return result;
}

export function replaceFileUrlsInFrontmatter(
  frontmatter: Record<string, any>,
  urlMap: Map<string, string>,
): Record<string, any> {
  const updated = { ...frontmatter };

  for (const [key, value] of Object.entries(updated)) {
    if (Array.isArray(value)) {
      updated[key] = value.map((item: any) => {
        if (typeof item === 'string') {
          let result = item;
          for (const [originalUrl, localPath] of urlMap) {
            const filename = path.basename(localPath);
            result = result.replaceAll(originalUrl, filename);
          }
          return result;
        }
        return item;
      });
    }
  }

  return updated;
}

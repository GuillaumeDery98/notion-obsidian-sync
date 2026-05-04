# File Download: Notion → Obsidian

**Goal:** Download all files attached to Notion pages (property + content blocks) into the Obsidian vault, replacing temporary Notion URLs with local paths.

**Direction:** One-way only (Notion → Obsidian). Files added in Obsidian are not uploaded to Notion.

**Storage:** `PARA/attachments/` in the vault.

---

## Sources of Files

### 1. "Fichiers et médias" property

Notion `files` type property on pages. Currently stored as array of temporary URLs in frontmatter (`fichiers_et_médias: [...]`).

**After:** URLs replaced with local paths:
```yaml
fichiers_et_médias:
  - attachments/2d153f3a_screenshot.png
```

### 2. Image/file/embed blocks in content

Blocks of type `image`, `file`, `pdf`, `video`, `audio`, `embed` within page content. Currently converted to markdown with temporary Notion URLs.

**After:** URLs replaced with local paths:
```markdown
![](attachments/2d153f3a_diagram.png)
```

## File Naming

Pattern: `{original_filename}_{notion_id_short}`

- `original_filename`: the original filename from Notion, sanitized (no special chars)
- `notion_id_short`: first 8 chars of the Notion page ID (avoids collisions)
- If collision: append `_2`, `_3`, etc.

Examples:
- `screenshot_2d153f3a.png`
- `document_2d153f3a.pdf`
- `photo_2d153f3a_2.jpg`

## State Tracking

`sync-state.json` adds a top-level `files` map:

```json
{
  "files": {
    "2d153f3a_screenshot.png": {
      "notionPageId": "2d153f3a-8b91-8052-951f-c71f18e980f9",
      "originalUrl": "https://s3.us-west-2.amazonaws.com/secure.notion-static.com/...",
      "downloadedAt": "2026-05-04T12:00:00.000Z"
    }
  }
}
```

Files are skipped if already present in state and the file exists on disk.

## Flow

1. **During create/update-in-obsidian:**
   - Extract file URLs from page properties (`files` type props) and blocks (`image`, `file`, `pdf`, `video`, `audio`)
   - For each URL not already tracked in state:
     - Download to `PARA/attachments/{short_id}_{name}.{ext}`
     - Add to state
   - Replace all Notion URLs in frontmatter and content with `attachments/filename.ext`

2. **During read phase (Obsidian → Notion):**
   - Files in `PARA/attachments/` are NOT scanned or modified
   - The reader already skips non-.md files

3. **File deletion:**
   - If a Notion page is deleted → the sync deletes the .md file but keeps the attachment files
   - Attachments are only cleaned up manually (YAGNI for auto-cleanup)

## Error Handling

- Download failure → log error, continue sync, keep original URL (don't replace with local path)
- Network timeout → retry with existing `withRetry` mechanism
- Disk full → error logged, sync continues for other pages

## Implementation

**New file:**
- `src/sync/files.ts` — `downloadFile()`, `downloadPageFiles()`, `replaceFileUrls()`

**Modified files:**
- `src/sync/state.ts` — add `files` to SyncState type, load/save support
- `src/sync/engine.ts` — call `downloadPageFiles()` in create/update-in-obsidian handlers
- `src/notion/converter.ts` — no changes needed (URLs replaced after conversion)
- `src/types.ts` — add `FileInfo` type

**No changes to:**
- `src/notion/push.ts` — Obsidian → Notion flow doesn't handle files
- `src/obsidian/reader.ts` — already skips non-.md files

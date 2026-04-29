import { describe, it, expect } from 'vitest';
import { notionToMarkdown, markdownToNotionBlocks } from '../../src/notion/converter.js';

describe('notionToMarkdown', () => {
  it('converts paragraph blocks', () => {
    const blocks = [
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Hello world', type: 'text', text: { content: 'Hello world' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('Hello world');
  });

  it('converts heading blocks', () => {
    const blocks = [
      { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Title', type: 'text', text: { content: 'Title' } }] } },
      { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Subtitle', type: 'text', text: { content: 'Subtitle' } }] } },
      { type: 'heading_3', heading_3: { rich_text: [{ plain_text: 'Section', type: 'text', text: { content: 'Section' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('# Title\n\n## Subtitle\n\n### Section');
  });

  it('converts list blocks', () => {
    const blocks = [
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Item 1', type: 'text', text: { content: 'Item 1' } }] } },
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Item 2', type: 'text', text: { content: 'Item 2' } }] } },
      { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'First', type: 'text', text: { content: 'First' } }] } },
      { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'Second', type: 'text', text: { content: 'Second' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('- Item 1\n- Item 2\n\n1. First\n2. Second');
  });

  it('converts to_do blocks', () => {
    const blocks = [
      { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Task', type: 'text', text: { content: 'Task' } }], checked: true } },
      { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Todo', type: 'text', text: { content: 'Todo' } }], checked: false } },
    ];
    expect(notionToMarkdown(blocks)).toBe('- [x] Task\n- [ ] Todo');
  });

  it('converts code blocks', () => {
    const blocks = [
      { type: 'code', code: { rich_text: [{ plain_text: 'const x = 1;', type: 'text', text: { content: 'const x = 1;' } }], language: 'typescript' } },
    ];
    expect(notionToMarkdown(blocks)).toBe('```typescript\nconst x = 1;\n```');
  });

  it('converts divider', () => {
    const blocks = [
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Above', type: 'text', text: { content: 'Above' } }] } },
      { type: 'divider', divider: {} },
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Below', type: 'text', text: { content: 'Below' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('Above\n\n---\n\nBelow');
  });

  it('converts quote blocks', () => {
    const blocks = [
      { type: 'quote', quote: { rich_text: [{ plain_text: 'Citation', type: 'text', text: { content: 'Citation' } }] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('> Citation');
  });

  it('converts image blocks', () => {
    const blocks = [
      { type: 'image', image: { type: 'external', external: { url: 'https://example.com/img.png' }, caption: [] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('![](https://example.com/img.png)');
  });

  it('converts bookmark blocks', () => {
    const blocks = [
      { type: 'bookmark', bookmark: { url: 'https://example.com', caption: [] } },
    ];
    expect(notionToMarkdown(blocks)).toBe('[https://example.com](https://example.com)');
  });

  it('handles inline rich text formatting', () => {
    const blocks = [
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { plain_text: 'Hello ', type: 'text', text: { content: 'Hello ' } },
            { plain_text: 'world', type: 'text', text: { content: 'world' }, annotations: { bold: true, italic: false, strikethrough: false, code: false, underline: false, color: 'default' } },
            { plain_text: ' and ', type: 'text', text: { content: ' and ' } },
            { plain_text: 'code', type: 'text', text: { content: 'code' }, annotations: { bold: false, italic: false, strikethrough: false, code: true, underline: false, color: 'default' } },
          ],
        },
      },
    ];
    expect(notionToMarkdown(blocks)).toBe('Hello **world** and `code`');
  });

  it('returns empty string for empty blocks', () => {
    expect(notionToMarkdown([])).toBe('');
  });
});

describe('markdownToNotionBlocks', () => {
  it('converts headings', () => {
    const blocks = markdownToNotionBlocks('# Title\n\n## Sub\n\n### Section');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('heading_1');
    expect(blocks[1].type).toBe('heading_2');
    expect(blocks[2].type).toBe('heading_3');
  });

  it('converts paragraphs', () => {
    const blocks = markdownToNotionBlocks('Hello world');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
  });

  it('converts bullet lists', () => {
    const blocks = markdownToNotionBlocks('- Item 1\n- Item 2');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('bulleted_list_item');
    expect(blocks[1].type).toBe('bulleted_list_item');
  });

  it('converts numbered lists', () => {
    const blocks = markdownToNotionBlocks('1. First\n2. Second');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('numbered_list_item');
    expect(blocks[1].type).toBe('numbered_list_item');
  });

  it('converts checkboxes', () => {
    const blocks = markdownToNotionBlocks('- [x] Done\n- [ ] Todo');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('to_do');
    expect((blocks[0] as any).to_do.checked).toBe(true);
    expect((blocks[1] as any).to_do.checked).toBe(false);
  });

  it('converts code blocks', () => {
    const blocks = markdownToNotionBlocks('```ts\ncode\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('code');
    expect((blocks[0] as any).code.language).toBe('ts');
  });

  it('converts quotes', () => {
    const blocks = markdownToNotionBlocks('> Citation');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('quote');
  });

  it('converts dividers', () => {
    const blocks = markdownToNotionBlocks('Above\n\n---\n\nBelow');
    expect(blocks).toHaveLength(3);
    expect(blocks[1].type).toBe('divider');
  });

  it('handles empty input', () => {
    expect(markdownToNotionBlocks('')).toEqual([]);
  });
});

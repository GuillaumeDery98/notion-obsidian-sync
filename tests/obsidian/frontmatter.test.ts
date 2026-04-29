import { describe, it, expect } from 'vitest';
import { parseFrontmatter, generateFrontmatter, extractTitle, buildFileContent } from '../../src/obsidian/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter from raw file content', () => {
    const raw = '---\nnotion_id: "abc"\ndatabase: taches\nstatus: "To Do"\n---\n\nBody text';
    const result = parseFrontmatter(raw);
    expect(result.frontmatter.notion_id).toBe('abc');
    expect(result.frontmatter.database).toBe('taches');
    expect(result.frontmatter.status).toBe('To Do');
    expect(result.content).toBe('Body text');
  });

  it('handles file without frontmatter', () => {
    const raw = 'Just body text\nNo frontmatter';
    const result = parseFrontmatter(raw);
    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe('Just body text\nNo frontmatter');
  });

  it('parses wikilink arrays', () => {
    const raw = '---\nnotion_id: "x"\ndatabase: projets\nareas:\n  - "[[Saas]]"\n  - "[[Work]]"\n---\n\nContent';
    const result = parseFrontmatter(raw);
    expect(result.frontmatter.areas).toEqual(['[[Saas]]', '[[Work]]']);
  });

  it('parses boolean and number values', () => {
    const raw = '---\nfiction: true\nrating: 4\n---\n\nText';
    const result = parseFrontmatter(raw);
    expect(result.frontmatter.fiction).toBe(true);
    expect(result.frontmatter.rating).toBe(4);
  });
});

describe('generateFrontmatter', () => {
  it('generates YAML frontmatter with wikilink arrays', () => {
    const fm = generateFrontmatter({
      notion_id: 'abc',
      database: 'projets',
      selection: 'Doing',
      areas: ['[[Saas]]'],
    });
    expect(fm).toContain('notion_id: abc');
    expect(fm).toContain('database: projets');
    expect(fm).toContain('selection: Doing');
    expect(fm).toContain('- "[[Saas]]"');
  });

  it('handles empty frontmatter', () => {
    const fm = generateFrontmatter({});
    expect(fm).toBe('');
  });
});

describe('extractTitle', () => {
  it('extracts title from markdown heading', () => {
    expect(extractTitle('# My Title\nBody')).toBe('My Title');
  });

  it('returns empty string if no heading', () => {
    expect(extractTitle('Just body text')).toBe('');
  });
});

describe('buildFileContent', () => {
  it('combines frontmatter and body', () => {
    const result = buildFileContent({ notion_id: 'x' }, 'Body text');
    expect(result).toContain('---');
    expect(result).toContain('notion_id: x');
    expect(result).toContain('Body text');
  });
});

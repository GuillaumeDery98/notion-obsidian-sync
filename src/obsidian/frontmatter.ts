import matter from 'gray-matter';
import yaml from 'js-yaml';

export interface ParsedFile {
  frontmatter: Record<string, any>;
  content: string;
}

export function parseFrontmatter(raw: string): ParsedFile {
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data,
    content: parsed.content.trim(),
  };
}

export function generateFrontmatter(fm: Record<string, any>): string {
  const keys = Object.keys(fm);
  if (!keys.length) return '';

  const yamlStr = yaml.dump(fm, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    replacer: (key: string, value: any) => {
      if (typeof value === 'string' && value.startsWith('[[') && value.endsWith(']]')) {
        return value;
      }
      return value;
    },
  });

  return `---\n${yamlStr.trim()}\n---`;
}

export function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

export function buildFileContent(fm: Record<string, any>, body: string): string {
  const fmStr = generateFrontmatter(fm);
  if (fmStr) {
    return `${fmStr}\n\n${body}`;
  }
  return body;
}

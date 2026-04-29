export function notionToMarkdown(blocks: any[]): string {
  if (!blocks.length) return '';

  const lines: string[] = [];
  let prevType: string | null = null;
  let numberedIndex = 0;

  for (const block of blocks) {
    const type = block.type;
    const needsBlankLine = prevType !== null && !isListType(type, prevType);
    if (needsBlankLine) lines.push('');

    if (type !== 'numbered_list_item') numberedIndex = 0;

    switch (type) {
      case 'paragraph':
        lines.push(richTextToMarkdown(block.paragraph.rich_text));
        break;
      case 'heading_1':
        lines.push('# ' + richTextToMarkdown(block.heading_1.rich_text));
        break;
      case 'heading_2':
        lines.push('## ' + richTextToMarkdown(block.heading_2.rich_text));
        break;
      case 'heading_3':
        lines.push('### ' + richTextToMarkdown(block.heading_3.rich_text));
        break;
      case 'bulleted_list_item':
        lines.push('- ' + richTextToMarkdown(block.bulleted_list_item.rich_text));
        break;
      case 'numbered_list_item':
        numberedIndex++;
        lines.push(`${numberedIndex}. ` + richTextToMarkdown(block.numbered_list_item.rich_text));
        break;
      case 'to_do': {
        const checked = block.to_do.checked ? 'x' : ' ';
        lines.push(`- [${checked}] ` + richTextToMarkdown(block.to_do.rich_text));
        break;
      }
      case 'code': {
        const lang = block.code.language || '';
        const code = richTextToMarkdown(block.code.rich_text);
        lines.push('```' + lang + '\n' + code + '\n```');
        break;
      }
      case 'quote':
        lines.push('> ' + richTextToMarkdown(block.quote.rich_text));
        break;
      case 'divider':
        lines.push('---');
        break;
      case 'image': {
        const imgUrl = block.image.type === 'external'
          ? block.image.external.url
          : block.image.file?.url ?? '';
        const imgCaption = block.image.caption?.length
          ? richTextToMarkdown(block.image.caption)
          : '';
        lines.push(`![${imgCaption}](${imgUrl})`);
        break;
      }
      case 'bookmark':
        lines.push(`[${block.bookmark.url}](${block.bookmark.url})`);
        break;
      case 'embed':
        lines.push(`[${block.embed.url}](${block.embed.url})`);
        break;
      default:
        if (block[type]?.rich_text) {
          lines.push(richTextToMarkdown(block[type].rich_text));
        }
    }

    prevType = type;
  }

  return lines.join('\n');
}

function isListType(a: string, b: string): boolean {
  return a === b;
}

function richTextToMarkdown(richText: any[]): string {
  if (!richText?.length) return '';
  return richText.map((rt: any) => {
    let text = rt.plain_text ?? rt.text?.content ?? '';
    const ann = rt.annotations;
    if (ann) {
      if (ann.bold) text = `**${text}**`;
      if (ann.italic) text = `*${text}*`;
      if (ann.strikethrough) text = `~~${text}~~`;
      if (ann.code) text = `\`${text}\``;
    }
    if (rt.href) {
      text = `[${text}](${rt.href})`;
    }
    return text;
  }).join('');
}

export function markdownToNotionBlocks(markdown: string): any[] {
  if (!markdown.trim()) return [];

  const blocks: any[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({
        type: 'heading_3',
        heading_3: { rich_text: [makeTextObj(line.slice(4))] },
      });
      i++;
    } else if (line.startsWith('## ')) {
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: [makeTextObj(line.slice(3))] },
      });
      i++;
    } else if (line.startsWith('# ')) {
      blocks.push({
        type: 'heading_1',
        heading_1: { rich_text: [makeTextObj(line.slice(2))] },
      });
      i++;
    } else if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({
        type: 'code',
        code: {
          rich_text: [makeTextObj(codeLines.join('\n'))],
          language: lang || 'plain text',
        },
      });
    } else if (line.startsWith('> ')) {
      blocks.push({
        type: 'quote',
        quote: { rich_text: [makeTextObj(line.slice(2))] },
      });
      i++;
    } else if (line === '---') {
      blocks.push({ type: 'divider', divider: {} });
      i++;
    } else if (line.match(/^- \[([ xX])\] /)) {
      const checked = line[3] !== ' ';
      const text = line.slice(6);
      blocks.push({
        type: 'to_do',
        to_do: { rich_text: [makeTextObj(text)], checked },
      });
      i++;
    } else if (line.startsWith('- ')) {
      blocks.push({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [makeTextObj(line.slice(2))] },
      });
      i++;
    } else if (line.match(/^\d+\. /)) {
      const text = line.replace(/^\d+\. /, '');
      blocks.push({
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: [makeTextObj(text)] },
      });
      i++;
    } else {
      blocks.push({
        type: 'paragraph',
        paragraph: { rich_text: [makeTextObj(line)] },
      });
      i++;
    }
  }

  return blocks;
}

function makeTextObj(text: string): any {
  return {
    type: 'text',
    text: { content: text },
    plain_text: text,
  };
}

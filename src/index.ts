import chalk from 'chalk';
import { loadConfig } from './config.js';
import { executeSync, SyncDirection } from './sync/engine.js';

function parseArgs(): { direction: SyncDirection } {
  const args = process.argv.slice(2);

  if (args.length === 0) return { direction: 'both' };

  const arg = args[0];
  if (arg === '--notion-to-obsidian' || arg === '--pull') return { direction: 'notion-to-obsidian' };
  if (arg === '--obsidian-to-notion' || arg === '--push') return { direction: 'obsidian-to-notion' };
  if (arg === '--both') return { direction: 'both' };

  console.error(chalk.red(`Unknown option: ${arg}`));
  console.error(chalk.gray('Usage: npm run sync [--pull|--push|--both]'));
  console.error(chalk.gray('  --pull,  --notion-to-obsidian  Notion → Obsidian only'));
  console.error(chalk.gray('  --push,  --obsidian-to-notion  Obsidian → Notion only'));
  console.error(chalk.gray('  --both                        Bidirectional (default)'));
  process.exit(1);
}

async function main() {
  const { direction } = parseArgs();

  const labels: Record<SyncDirection, string> = {
    'both': 'Notion ↔ Obsidian Sync',
    'notion-to-obsidian': 'Notion → Obsidian Sync',
    'obsidian-to-notion': 'Obsidian → Notion Sync',
  };

  console.log(chalk.blue(labels[direction]));
  console.log(chalk.gray('─'.repeat(30)));

  try {
    const config = await loadConfig();
    const result = await executeSync(config, direction);

    console.log(chalk.gray('─'.repeat(30)));
    console.log(chalk.green(`Created: ${result.created}`));
    console.log(chalk.yellow(`Updated: ${result.updated}`));
    console.log(chalk.red(`Deleted: ${result.deleted}`));
    console.log(chalk.gray(`Skipped: ${result.skipped}`));

    if (result.errors.length) {
      console.log(chalk.red(`\nErrors (${result.errors.length}):`));
      for (const err of result.errors) {
        console.log(chalk.red(`  - ${err.phase}: ${err.message}`));
      }
    }

    console.log(chalk.gray('─'.repeat(30)));
    console.log(chalk.green('Sync complete!'));
  } catch (error: any) {
    console.error(chalk.red('Sync failed:'), error.message);
    process.exit(1);
  }
}

main();

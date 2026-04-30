import chalk from 'chalk';
import { loadConfig } from './config.js';
import { executeSync } from './sync/engine.js';

async function main() {
  console.log(chalk.blue('Notion ↔ Obsidian Sync'));
  console.log(chalk.gray('─'.repeat(30)));

  try {
    const config = await loadConfig();
    const result = await executeSync(config);

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

/**
 * This script is used to proxy nx commands to change the default options.
 */

const { spawnSync } = require('child_process');
const cores = require('os').cpus().length;

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node run-test.js <nx-command> [args]');
  process.exit(1);
}

// Check for --parallel option and set it to the number of CPU cores if not provided
if (!args.some(arg => arg.startsWith('--parallel'))) {
  args.push(`--parallel=${cores}`);
}

const result = spawnSync('pnpm', ['exec', 'nx', ...args], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);

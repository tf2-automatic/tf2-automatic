const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: { '@nx/dependency-checks': 'error' },
    languageOptions: { parser: require('jsonc-eslint-parser') },
  },
  {
    files: ['./package.json', './executors.json'],
    rules: { '@nx/nx-plugin-checks': 'error' },
    languageOptions: { parser: require('jsonc-eslint-parser') },
  },
];

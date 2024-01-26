module.exports = {
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'angular',
        releaseRules: [{ type: 'refactor', release: 'patch' }],
      },
    ],
    '@semantic-release/release-notes-generator',
    '@semantic-release/github',
  ],
  branches: [
    'main',
    { name: 'beta', prerelease: true },
    { name: 'dev', prerelease: true },
  ],
};

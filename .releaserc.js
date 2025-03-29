module.exports = {
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'angular',
        releaseRules: [{ type: 'refactor', release: 'patch' }],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'angular',
        presetConfig: {
          types: [{ type: 'refactor', section: 'Refactoring' }],
        },
      },
    ],
    [
      '@semantic-release/github',
      {
        successCommentCondition: false,
        failTitle: false,
      },
    ],
  ],
  branches: [
    'main',
    { name: 'beta', prerelease: true },
    { name: 'dev', prerelease: true },
  ],
};

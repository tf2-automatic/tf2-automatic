const { composePlugins, withNx } = require('@nx/webpack');
const AddPnpmPatchedDependencies = require('../../scripts/pnpm-patched-dependencies');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Update the webpack config as needed here.
  // e.g. `config.plugins.push(new MyPlugin())`
  config.plugins.push(new AddPnpmPatchedDependencies());

  // OpenTelemetry auto-instrumentation relies on require-in-the-middle /
  // import-in-the-middle, which emit "Critical dependency" warnings. The
  // packages are externalized, so this is safe to ignore.
  config.ignoreWarnings = [
    ...(config.ignoreWarnings ?? []),
    /require-in-the-middle/,
    /import-in-the-middle/,
  ];

  return config;
});

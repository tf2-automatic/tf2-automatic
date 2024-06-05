const { composePlugins, withNx } = require('@nx/webpack');
const AddPnpmPatchedDependencies = require('../../scripts/pnpm-patched-dependencies');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Update the webpack config as needed here.
  // e.g. `config.plugins.push(new MyPlugin())`
  config.plugins.push(new AddPnpmPatchedDependencies());

  return config;
});

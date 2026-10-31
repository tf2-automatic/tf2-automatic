// Path aliases are not resolved in globalSetup
// eslint-disable-next-line @nx/enforce-module-boundaries
import { setup } from '../../../../libs/testing/src/e2e';

module.exports = async function () {
  await setup({
    cwd: './apps/bptf-manager-e2e',
    compose: true,
    app: 'bptf-manager',
  });
};

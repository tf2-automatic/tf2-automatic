// Path aliases are not resolved in globalSetup
// eslint-disable-next-line @nx/enforce-module-boundaries
import { setup } from '../../../testing/src/e2e';

module.exports = async function () {
  await setup({ cwd: './libs/queue-e2e', compose: true });
};

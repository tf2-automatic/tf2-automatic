// Path aliases are not resolved in globalTeardown
// eslint-disable-next-line @nx/enforce-module-boundaries
import { teardown } from '../../../../libs/testing/src/e2e';

module.exports = async function () {
  await teardown();
};

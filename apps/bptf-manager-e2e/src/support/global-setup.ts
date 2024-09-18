import { setup } from '../../../../libs/testing/src/e2e';

module.exports = async function () {
  await setup('bptf-manager', true);
};

import { e2e } from '@tf2-automatic/testing';

module.exports = async function () {
  await e2e.setup('bptf-manager', true);
};

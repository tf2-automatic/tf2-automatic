import { ChildProcess } from 'child_process';
import { v2 as compose } from 'docker-compose';

module.exports = async function () {
  console.log('\nTearing down...');

  console.log('Stopping application...');
  const childProcess = globalThis.__childProcess as ChildProcess;
  childProcess.kill();

  await new Promise<void>((resolve) => {
    childProcess.on('exit', () => {
      resolve();
    });
  });

  console.log('Stopping Docker Compose...');
  await compose.down({ cwd: './apps/bptf-manager-e2e' });
};

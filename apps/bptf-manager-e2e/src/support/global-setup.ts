import { spawn } from 'child_process';
import { v2 as compose } from 'docker-compose';

module.exports = async function () {
  console.log('\nSetting up...');

  const result = await compose.ps({ cwd: './apps/bptf-manager-e2e' });
  if (result.data.services.length > 0) {
    throw new Error('Docker compose services are already running');
  }

  console.log('Starting Docker Compose...');
  await compose.upAll({ cwd: './apps/bptf-manager-e2e' });

  console.log('Starting application...');

  await new Promise<void>((resolve, reject) => {
    const childProcess = spawn('pnpm exec nx run bptf-manager:serve:e2e', {
      shell: true,
    });

    globalThis.__childProcess = childProcess;

    if (!childProcess.stdout) {
      return reject(new Error('No stdout'));
    }

    const timeout = setTimeout(() => {
      childProcess.removeAllListeners();
      childProcess.kill();
      reject(new Error('Application did not start'));
    }, 60000).unref();

    childProcess.stdout.on('data', (data) => {
      if (data.indexOf('Nest application successfully started') !== -1) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  console.log('Application started\n');
};

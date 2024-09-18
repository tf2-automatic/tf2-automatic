import { ChildProcess, spawn } from 'child_process';
import { v2 as compose } from 'docker-compose';

export async function setup(app: string, useCompose = false) {
  globalThis.__app = app;

  console.log('\nSetting up...');

  if (useCompose) {
    const result = await compose.ps({ cwd: `./apps/${app}-e2e` });
    if (result.data.services.length > 0) {
      throw new Error('Docker compose services are already running');
    }

    console.log('Starting Docker Compose...');
    await compose.upAll({ cwd: `./apps/${app}-e2e` });

    globalThis.__compose = true;
  }

  console.log('Starting application...');

  await new Promise<void>((resolve, reject) => {
    const childProcess = spawn(`pnpm exec nx run ${app}:serve:e2e`, {
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
}

export async function teardown() {
  console.log('\nTearing down...');

  console.log('Stopping application...');
  const childProcess = globalThis.__childProcess as ChildProcess;
  childProcess.kill();

  await new Promise<void>((resolve) => {
    childProcess.on('exit', () => {
      resolve();
    });
  });

  if (!globalThis.__compose) {
    return;
  }

  console.log('Stopping Docker Compose...');
  await compose.down({
    cwd: `./apps/${globalThis.__app}-e2e`,
    commandOptions: ['--volumes'],
  });
}

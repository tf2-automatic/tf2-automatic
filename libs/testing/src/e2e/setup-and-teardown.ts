import { ChildProcess, spawn } from 'child_process';
import compose from 'docker-compose';

interface SetupOptions {
  // Directory of the e2e project
  cwd: string;
  // Start the services in the docker-compose.yaml of the project
  compose?: boolean;
  // Start this app and wait for it to be ready
  app?: string;
}

export async function setup(options: SetupOptions) {
  globalThis.__setupOptions = options;

  console.log('\nSetting up...');

  if (options.compose) {
    const result = await compose.ps({ cwd: options.cwd });
    if (result.data.services.length > 0) {
      throw new Error('Docker compose services are already running');
    }

    console.log('Starting Docker Compose...');
    await compose.upAll({ cwd: options.cwd, commandOptions: ['--wait'] });
  }

  if (!options.app) {
    return;
  }

  console.log('Starting application...');

  const app = options.app;
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
  const options = globalThis.__setupOptions as SetupOptions;

  console.log('\nTearing down...');

  if (options.app) {
    console.log('Stopping application...');
    const childProcess = globalThis.__childProcess as ChildProcess;
    childProcess.kill();

    await new Promise<void>((resolve) => {
      childProcess.on('exit', () => {
        resolve();
      });
    });
  }

  if (options.compose) {
    console.log('Stopping Docker Compose...');
    await compose.down({ cwd: options.cwd, commandOptions: ['--volumes'] });
  }
}

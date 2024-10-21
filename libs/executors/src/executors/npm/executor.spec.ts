import { ExecutorContext } from '@nx/devkit';
import executor, { NPMExecutorOptions } from './executor';
import path from 'path';

const mockedPackageJson = JSON.stringify(
  {
    name: 'mock-project',
    version: 'latest',
    dependencies: {},
    main: './src/index.js',
    type: 'commonjs',
  },
  undefined,
  2,
);

const context: ExecutorContext = {
  root: '',
  projectName: 'mock-project',
  projectsConfigurations: {
    projects: {
      'mock-project': {
        root: '',
        sourceRoot: '',
        targets: {
          build: {
            options: {
              outputPath: 'dist/libs/mock-project',
            },
          },
        },
      },
    },
    version: 2,
  },
  cwd: process.cwd(),
  isVerbose: false,
  nxJsonConfiguration: {},
  projectGraph: {
    nodes: {},
    dependencies: {},
  },
};

jest.mock('fs');
jest.mock('child_process');

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const child_process = require('child_process');
/* eslint-enable @typescript-eslint/no-require-imports */

fs.readFileSync = jest.fn(() => mockedPackageJson);
fs.writeFileSync = jest.fn();

child_process.exec = jest
  .fn()
  .mockImplementation((command, options, callback) => {
    callback(null, 'stdout', 'stderr');
  });

describe('NPM Executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('can run', async () => {
    const options: NPMExecutorOptions = {
      'release-version': '1.0.0',
      'release-tag': 'latest',
      'dry-run': true,
    };

    const output = await executor(options, context);
    expect(output.success).toBe(true);
  });

  it('fails when invalid options', async () => {
    const options = {
      'release-version': 'abc',
      'release-tag': undefined,
    };

    // @ts-expect-error - Testing invalid options
    await expect(executor(options, context)).rejects.toThrow();
  });

  it('correctly finds the build output path', async () => {
    const options: NPMExecutorOptions = {
      'release-version': '1.0.0',
      'release-tag': 'latest',
      'dry-run': true,
    };

    await executor(options, context);

    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.normalize('dist/libs/mock-project/package.json'),
      'utf-8',
    );
  });

  it('publishes the npm package', async () => {
    const options: NPMExecutorOptions = {
      'release-version': '1.0.0',
      'release-tag': 'latest',
    };

    const output = await executor(options, context);
    expect(output.success).toBe(true);

    expect(child_process.exec).toHaveBeenCalledWith(
      'npm publish --tag latest',
      { cwd: path.normalize('dist/libs/mock-project') },
      expect.any(Function),
    );
  });

  it('properly handles "dry-run" option', async () => {
    const options: NPMExecutorOptions = {
      'release-version': '1.0.0',
      'release-tag': 'latest',
      'dry-run': true,
    };

    const output = await executor(options, context);
    expect(output.success).toBe(true);

    expect(fs.writeFileSync).toHaveBeenCalledTimes(0);
    expect(child_process.exec).toHaveBeenCalledWith(
      'npm publish --tag latest --dry-run',
      expect.any(Object),
      expect.any(Function),
    );
  });
});

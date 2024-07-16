import type { ExecutorContext } from '@nx/devkit';
import * as path from 'path';
import { exec } from 'child_process';
import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsSemVer,
  IsString,
  validate,
  ValidationError,
} from 'class-validator';
import { readFileSync, writeFileSync } from 'fs';
import { promisify } from 'util';

export class NPMExecutorOptions {
  @IsSemVer()
  'release-version': string;

  @IsString()
  'release-tag': string;

  @IsOptional()
  @IsBoolean()
  'dry-run'?: boolean;
}

function formatErrors(errors: ValidationError[]): string {
  let errorMessage = '';

  for (const error of errors) {
    if (!error.constraints) {
      break;
    }

    for (const key in error.constraints) {
      if (errorMessage !== '') {
        errorMessage += ', ';
      }
      errorMessage += `${error.constraints[key]}`;
    }
  }

  return errorMessage;
}

async function validateOptions(options: NPMExecutorOptions): Promise<void> {
  const instance = plainToInstance(NPMExecutorOptions, options);

  const errors = await validate(instance);
  if (errors.length !== 0) {
    let errorMessage = formatErrors(errors);

    if (errorMessage === '') {
      errorMessage = 'Failed to validate options';
    } else {
      errorMessage = 'Failed to validate options: ' + errorMessage;
    }

    throw new Error(errorMessage);
  }
}

function getBuildOutputsDirectory(context: ExecutorContext): string {
  if (!context.projectName) {
    throw new Error('Project name missing in context');
  }

  const projectName = context.projectName;

  if (!context.projectsConfigurations) {
    throw new Error('Projects configurations missing in context');
  }

  const projectConfiguration =
    context.projectsConfigurations.projects[projectName];

  if (!projectConfiguration.targets) {
    throw new Error('Targets missing in project configuration');
  }

  return projectConfiguration.targets.build.options.outputPath;
}

function getPackageJsonPath(context: ExecutorContext): string {
  const outputDirectory = path.join(
    context.root,
    getBuildOutputsDirectory(context),
  );

  return path.join(outputDirectory, 'package.json');
}

function getPackageJson(fullPath: string): Record<string, unknown> {
  const packageJson = readFileSync(fullPath, 'utf-8');
  return JSON.parse(packageJson);
}

export default async function npmExecutor(
  options: NPMExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  await validateOptions(options);

  const packageJsonPath = getPackageJsonPath(context);

  const packageJson = getPackageJson(packageJsonPath);
  packageJson.version = options['release-version'];

  if (options['dry-run'] !== true) {
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, undefined, 2));
  }

  let args = '';
  if (options['release-tag']) {
    args += ` --tag ${options['release-tag']}`;
  }

  if (options['dry-run']) {
    args += ' --dry-run';
  }

  const { stdout, stderr } = await promisify(exec)(`npm publish${args}`, {
    cwd: path.dirname(packageJsonPath),
  });

  if (stdout) {
    console.log(stdout);
  }

  if (stderr) {
    console.error(stderr);
  }

  const success = !stderr;
  return { success };
}

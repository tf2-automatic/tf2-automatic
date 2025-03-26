import fs from 'fs';
import path from 'path';

export function getAppNameAndVersion(): { name: string, version: string, } | null {
  if (process.env['NODE_ENV'] === 'test') {
    return null;
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
  );

  return {
    name: packageJson.name,
    version: packageJson.version
  };
}

export function getUserAgent(): string | null {
  const app = getAppNameAndVersion();
  if (app === null) {
    return null;
  }

  return `tf2-automatic/${app.name} v${app.version}`;
}

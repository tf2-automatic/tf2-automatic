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

export function getUserAgentOrThrow(version = true): string {
  const userAgent = getUserAgent(version);
  if (userAgent === null) {
    throw new Error('Unable to get user agent');
  }
  return userAgent;
}

export function getUserAgent(version = true): string | null {
  const app = getAppNameAndVersion();
  if (app === null) {
    return null;
  }

  let userAgent = `tf2-automatic/${app.name}`;
  if (version) {
    userAgent += ` v${app.version}`;
  }

  return userAgent;
}

/**
 * Runs semantic-release and, only when a new version was released, exposes it as GitHub Actions step outputs.
 */

import semanticRelease from 'semantic-release';
import { appendFileSync } from 'node:fs';

const result = await semanticRelease();
const next = result?.nextRelease;

if (next) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `new_release_published=true\nnew_release_version=${next.version}\nnew_release_channel=${next.channel ?? 'latest'}\n`,
  );
}

const fs = require('fs');
const path = require('path');

class AddPnpmPatchedDependencies {
  apply(compiler) {
    compiler.hooks.done.tap('AddPnpmPatchedDependencies', (stats) => {
      const outputPath = stats.compilation.outputOptions.path;
      const packageJsonPath = path.join(outputPath, 'package.json');
      const originalPackageJsonPath = path.join(
        outputPath,
        '../../../package.json',
      );

      if (!fs.existsSync(packageJsonPath)) {
        // No package.json file found to merge with
        return;
      }

      const originalPackageJson = JSON.parse(
        fs.readFileSync(originalPackageJsonPath),
      );

      if (originalPackageJson.pnpm === undefined) {
        // No pnpm field in the original package.json
        return;
      }

      const generatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath));

      // Merge the fields
      generatedPackageJson.pnpm = generatedPackageJson.pnpm || {};
      generatedPackageJson.pnpm.patchedDependencies =
        originalPackageJson.pnpm.patchedDependencies;

      // console.log(generatedPackageJson);

      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(generatedPackageJson, null, 2),
      );
      console.log('Added pnpm fields to generated package.json');
    });
  }
}

module.exports = AddPnpmPatchedDependencies;

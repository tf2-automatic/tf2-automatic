module.exports = {
  hooks: {
    readPackage: (pkg) => {
      delete pkg.dependencies['@types/steamid'];
      delete pkg.devDependencies['@types/steamid'];
      return pkg;
    },
  },
};

# Welcome to the TF2 Automatic contributing guide

Thank you for showing interest in improving the project! This guide is made to help new contributors set up the project and propose changes.

## Getting started

This project is a monorepo and uses the [Nx](https://nx.dev/) monorepo tool to do a lot of cool things. If you are not familiar with Nx then please check out their [documentation](https://nx.dev/getting-started) and understand the [core concepts](https://nx.dev/core-features).

## Setting up project

It is recommended to use [Visual Studio Code](https://code.visualstudio.com/) and the [recommended extentions](./.vscode/extensions.json).

The project uses [pnpm](https://pnpm.io/) instead of npm. Install the dependencies using `pnpm install`.

Test if project is properly set up by attempting to build everything in the project using the following command: `node ./scripts/nx.js run-many -t build --all`. A graph of all applications and libraries can be seen using `mode ./scripts/nx.js graph`.

## Running applications locally

Use the command `docker compose up -d` in the root of the repository to start the required services using Docker. Once done then you may for example use the command `node ./scripts/nx.js serve bot` to run the bot application or `node ./scripts/nx.js run-many -t serve -p bot,bot-manager` to run both the bot and bot manager.

Nx automatically loads environment variables from [different files](https://nx.dev/recipes/environment-variables/define-environment-variables). To configure an application, create a file called `.env.local` inside the application directory. Environment variable files are ignored using the .gitignore file, but please make sure you don't commit any secret values.

## Building docker images

If you want to build a docker image of an application, then you first need to build the application. For example, if you want to build an image for the bot, then first use `node ./scripts/nx.js build bot` to build it and then use `docker build -f ./Dockerfile -t bot --build-arg SOURCE_DIR="./dist/apps/bot" --build-arg VERSION="0.0.1" .` in the root of the repository to build an image. The `SOURCE_DIR` build arg is used to define where the built source code is located, and the `VERSION` build arg is used to set the version field in the package.json file. All applications use the same Dockerfile.

## Contributing

Commits need to follow the [conventional commit format](https://www.conventionalcommits.org/en/v1.0.0/). Commit message linting has been set up to force you to follow the format. To ensure you follow the format, you can stage your changes and then use `npm run commit` to interactively create a commit message with the correct format.

The following steps should be used to make changes to the project and submit them on GitHub:

1. **Fork** the repository
2. **Clone** the fork to your computer
3. Create a **Branch** from the `main` branch
4. **Commit** changes to your branch (using `pnpm run commit`)
5. **Push** your work back to your fork
6. Submit a **Pull request** to the `main` branch

Note: Be sure to keep your own fork up to date with the upstream repository.

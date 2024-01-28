# Welcome to the TF2 Automatic contributing guide

Thank you for showing interest in improving the project! This guide is made to help new contributors set up the project and propose changes.

## Getting started

This project is a monorepo and uses the [Nx](https://nx.dev/) monorepo tool to do a lot of cool things. If you are not familiar with Nx then please check out their [documentation](https://nx.dev/getting-started) and understand the [core concepts](https://nx.dev/core-features).

## Setting up project

Use [Visual Studio Code](https://code.visualstudio.com/) and the [recommended extentions](./.vscode/extensions.json).

Install all dependencies using `npm install`.

Test if project is properly set up by attempting to build everything in the project using the following command: `npx nx run-many --target=build --all`. A graph of all applications and libraries, and their relations, can be seen using `npx nx graph`.

## Running applications locally

Use the command `npx nx serve bot` to run the bot application, and use `npx nx run-many --target=serve --projects=bot,bot-manager` to run both the bot and bot manager.

Nx automatically loads environment variables from [different files](https://nx.dev/recipes/environment-variables/define-environment-variables). To configure an application, create a file called `.env.local` inside the application directory. Environment variable files are ignored using the .gitignore file, but please make sure you don't commit any secret values.

## Building docker images

If you want to build a docker image of an application, then you first need to compile the application. For example, if you want to build an image for the bot, then use `npx nx build bot`. To build a docker image, then use `docker build -f ./apps/bot/Dockerfile -t bot .` when in the root of the repository, or `docker build -f Dockerfile -t bot ../../` if you are inside the bot folder.

## Contributing

Commits need to follow the [conventional commit format](https://www.conventionalcommits.org/en/v1.0.0/). Commit message linting has been set up to force you to follow the format. To ensure you follow the format, you can stage your changes and then use `npm run commit` to interactively create a commit message.

Use the following steps should be used to create changes to the project:

1. **Fork** the repository
2. **Clone** the fork to your computer
3. Create a **Branch** from the `main` branch
4. **Commit** changes to your branch (using `npm run commit`)
5. **Push** your work back to your fork
6. Submit a **Pull request** to the `main` branch

Note: Be sure to keep your own fork up to date with the upstream repository.

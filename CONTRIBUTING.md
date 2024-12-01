# Contributing to Robo.js

<!--
🚀 **By the way**: If you're here for Hacktoberfest submissions, thanks for stopping by! While this document is relevant for all contributions, it's not exclusive to the event. So, feel free to browse and contribute anytime!
-->

Hey there! First and foremost, a big **THANK YOU** for showing interest in our project. Whether you're looking to contribute code or simply suggest features, we're glad to have you here! 💙

This document will guide you through the process of contributing to Robo.js.

**Not a coder but got a neat idea?** No worries!

**➞ [📝 Suggest features by creating a GitHub Issue](https://github.com/Wave-Play/robo.js/issues)**

**➞ [🚀 Community: Join our Discord server](https://roboplay.dev/discord)**

Remember, contributing to the core is different from making your own Robo or plugin. If you're looking for a starter guide:

**➞ [📖 Tutorial: Making a "To-do" Robo](https://blog.waveplay.com/how-to-make-a-discord-robo)**

## Setup

You just need a few tools to get started.

1. **Node**: Ensure you have **[Node 18 or newer](https://nodejs.org/)**. Older versions might work but are not tested.
2. **Editor**: We recommend **[VS Code](https://code.visualstudio.com/)**, but **[GitHub Codespaces](https://github.com/features/codespaces/)** also works wonders.
3. **Package Manager**: We 💙 **[PNPM](https://pnpm.io/)**! Ensure you've got that. Simply run `pnpm install` after cloning the repo, and you're golden!

## Monorepo

Now that you're all set up, let's dive into the monorepo structure.

### Directories

- `/docs`: The documentation for Robo.js using Docusaurus.
- `/packages`: The core framework, plugins, and the create tool.
- `/templates`: Starter templates for Robo projects.

### Plugins

Plugins under the `packages` directory are not much different from normal Robo projects. They follow the **[Robo.js File structure](https://docs.roboplay.dev/docs/basics/overview#the-robojs-file-structure)** and use their `README.md` for documentation.

### Templates

Templates are example Robo projects. They're a great way to get started with Robo.js and see what's possible. You can also use them to test your plugins as you're developing them!

These templates were created using the `create-robo` tool and can be used with the `--template` flag. For example:

```bash
npx create-robo my-robo --template starter-activity-typescript
```

Want to add your own? We'd love to see it! 🎉

Just make a PR with your template in the `templates` directory. We'll review it and add it to the list. Just make sure to include a `README.md` with instructions on how to use it and what it does.

### Tools

We use a few tools to keep our code neat and tidy:

- **[Turborepo](https://turbo.build/repo)**: A monorepo tool that makes managing multiple packages a breeze.
- **[ESLint](https://eslint.org/)**: A linter that helps keep our code clean and consistent.
- **[Prettier](https://prettier.io/)**: An opinionated code formatter that ensures our code is always formatted correctly.

Got the right VS Code plugins? These tools will be a lot of help getting PRs approved. Otherwise, just run `pnpm lint` to check your code before submitting.

## Running

Ready to run the project?

1. **Fork the repo**: You'll need the entire monorepo to run the project.
2. **Install dependencies**: Run `pnpm install` to install all dependencies for the monorepo.
3. **Build binaries**: Run `pnpm build:robo` to build Robo.js. All other packages rely on it, even if you're not contributing to the core.
4. **Build packages**: Run `pnpm build` to build all packages. This will build all packages in the monorepo. You can also navigate to a specific package and run `pnpm build` there to build just that package.
5. **Test it out**: Whether you're working on the core or a plugin, you can test your changes by running `pnpm dev` in the package directory. You can then link your package to a Robo project using `pnpm add <dirToPkg>`.

If you'd like to auto rebuild, you can run `pnpm dev` instead of `pnpm build`. This will start a watcher that will rebuild your package whenever you make changes.

Plus, if you ran your test Robo in `dev` mode after that, it will automatically reload when you make changes!

> **Psst...** If you need a Robo project to test your plugin, you can use the `create-robo` tool to create one, or use one of the templates in the `/templates` directory.

## Submitting contributions

Ready to submit your changes? There's just a few things to keep in mind.

### Commits

We highly encourage you to follow **[Conventional Commits](https://www.conventionalcommits.org/)**. 📜

We follow **[Semantic Versioning](https://semver.org/)** (SemVer) for packages v1.0.0 and up. Under that? The second digit is for breaking changes and the third for everything else.

We also rely on **[Changesets](https://github.com/changesets/changesets)** for change management. Just run `pnpm changeset` and let the CLI guide you.

Starting a new package? Use `0.0.0` as your initial version and Changesets will handle the rest.

### Linting

Please lint your code before submitting a PR. We use **[ESLint](https://eslint.org/)** and **[Prettier](https://prettier.io/)** to keep our code neat and uniform across the entire monorepo.

Seriously, just run `pnpm lint` and you're good to go!

### Pull Requests

All set? Time to submit your PR!

- Ensure your PR is against the `main` branch.
- Give your PR a descriptive title and description.
- If your PR is a work in progress, add `[WIP]` to the title.
- If your PR is a fix for an existing issue, reference the issue in the description.
- Ensure you've made necessary changesets.

First-timer? Our CLA Assistant bot might pop up. Just sign the CLA and you're set!

## What to contribute

### Core

We always welcome contributions to the core: `robo.js`. Whether it's a bug fix, a new feature, or an enhancement, we're all ears!

### Documentation

Documentation is a crucial part of Robo.js. If you find something that's unclear, outdated, or missing, feel free to submit a PR!

### Plugins

Contribute to our official ones, enhance existing ones, or create your own!

For more, follow the **[plugin guide](https://docs.roboplay.dev/docs/advanced/plugins)**. Want a suggestion? A template project is a stellar way to test your plugin.

Ensure your plugin's `robo.js` version is consistent with your test project. For instance, if the Robo is at `0.10.0`, ensure your plugin's `devDependencies` match or you'll run into issues with stateful APIs like Flashcore or State.

### Templates

There's lots of awesome ways you can use Robo.js!

Templates are just example Robo projects. Starter templates are a great way to get started with Robo.js, and also a great way to see what's possible.

You can also use these to test your plugins as you're developing them! Just make sure to use a relative path. (e.g. `npx robo add ../../my-plugin`)

These templates are also used by the `create-robo` tool via the `--template` flag.

## Contributors

A round of applause for our amazing contributors! 🎉

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://pkmmte.com"><img src="https://avatars.githubusercontent.com/u/3953360?v=4?s=100" width="100px;" alt="Pkmmte Xeleon"/><br /><sub><b>Pkmmte Xeleon</b></sub></a><br /><a href="[✨]("WavePlay Staff")," title="WavePlay Staff">✨</a> <a href="https://github.com/Wave-Play/robo.js/commits?author=Pkmmte" title="Code">💻</a> <a href="#maintenance-Pkmmte" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Nazeofel"><img src="https://avatars.githubusercontent.com/u/96749659?v=4?s=100" width="100px;" alt="Alexander"/><br /><sub><b>Alexander</b></sub></a><br /><a href="[✨]("WavePlay Staff")," title="WavePlay Staff">✨</a> <a href="https://github.com/Wave-Play/robo.js/commits?author=Nazeofel" title="Code">💻</a> <a href="#maintenance-Nazeofel" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/0xMouiz"><img src="https://avatars.githubusercontent.com/u/96005374?v=4?s=100" width="100px;" alt="Mouiz"/><br /><sub><b>Mouiz</b></sub></a><br /><a href="https://github.com/Wave-Play/robo.js/commits?author=0xMouiz" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mbos2"><img src="https://avatars.githubusercontent.com/u/56090587?v=4?s=100" width="100px;" alt="Matej Bošnjak"/><br /><sub><b>Matej Bošnjak</b></sub></a><br /><a href="https://github.com/Wave-Play/robo.js/commits?author=mbos2" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ArnavK-09"><img src="https://avatars.githubusercontent.com/u/69188140?v=4?s=100" width="100px;" alt="Arnav K"/><br /><sub><b>Arnav K</b></sub></a><br /><a href="#example-ArnavK-09" title="Examples">💡</a> <a href="#plugin-ArnavK-09" title="Plugin/utility libraries">🔌</a> <a href="https://github.com/Wave-Play/robo.js/commits?author=ArnavK-09" title="Documentation">📖</a> <a href="https://github.com/Wave-Play/robo.js/commits?author=ArnavK-09" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/waruhachi"><img src="https://avatars.githubusercontent.com/u/156133757?v=4?s=100" width="100px;" alt="waru"/><br /><sub><b>waru</b></sub></a><br /><a href="https://github.com/Wave-Play/robo.js/commits?author=waruhachi" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/renejfc"><img src="https://avatars.githubusercontent.com/u/60465053?v=4?s=100" width="100px;" alt="René"/><br /><sub><b>René</b></sub></a><br /><a href="https://github.com/Wave-Play/robo.js/commits?author=renejfc" title="Code">💻</a></td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td align="center" size="13px" colspan="7">
        <img src="https://raw.githubusercontent.com/all-contributors/all-contributors-cli/1b8533af435da9854653492b1327a23a4dbd0a10/assets/logo-small.svg">
          <a href="https://all-contributors.js.org/docs/en/bot/usage">Add your contributions</a>
        </img>
      </td>
    </tr>
  </tfoot>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

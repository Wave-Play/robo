<p align="center">✨ <strong>Generated with <a href="https://robojs.dev/create-robo">create-robo</a> magic!</strong> ✨</p>

---

# Discord Bot - AI Chatbot (TS)

An intelligent **Discord Bot** using **[Robo.js](https://robojs.dev)** and **[@robojs/ai](https://robojs.dev/plugins/ai)** for AI chatbot capabilities. This template is set up for creating a chatbot that can respond to messages with AI-generated text. All you need is an **OpenAI** API key in your `.env` file.

_Ready to embark on this adventure?_

- [📚 **Documentation:** Getting started](https://docs.roboplay.dev/docs/getting-started)
- [🚀 **Community:** Join our Discord server](https://roboplay.dev/discord)

## ✨ Getting Started

Create a project with this template, replacing `<project-name>` with your desired name:

```bash
npx create-robo <project-name> --template discord-bots/ai-chatbot-ts
```

Then navigate into your project directory:

```bash
cd <project-name>
```

Run development mode:

```bash
npm run dev
```

- [📚 **Documentation:** Exploring Different Run Modes](https://robojs.dev/robojs/mode#default-modes)
- [🚀 **Documentation:** Deploying for Free with 24/7 Uptime](https://robojs.dev/hosting/overview)

## Developing 🏗️

Create new slash commands by making a new file under the `/src/commands` directory with an exported default function. The file's name becomes the command's name. You can either use the `interaction` parameter or return the result to let Sage handle it for you. For more info on commands, see the **[Discord.js Documentation](https://discord.js.org/#/docs/main/stable/general/welcome)**.

Commands will be automatically registered with Discord when needed, but you can force it by running `npx robo build -f`.

To listen to new events, create a file named after the event in `/src/events`. For example, `typingStart.js` will notify you when someone starts typing. You can stack multiple files for the same event by making a directory named after the event. Files inside it can be named whatever you want. For example:

```
- src
  - events
    - typingStart
      - your-file.js
      - another.js
```

**➞** [📚 **Documentation:** Slash commands](https://docs.roboplay.dev/docs/advanced/plugins#creating-plugins)

**➞** [📚 **Documentation:** Events](https://docs.roboplay.dev/docs/advanced/events)

**➞** [📚 **Documentation:** Context Menus](https://docs.roboplay.dev/docs/basics/context-menu)

## Debugging 🐞

Got bugs? No biggie! Robo.js has your back with nifty built-in debugging magic. During dev mode, Robo will provide you with error information, stack traces, interactive logs, and even a sneak peek at the exact code that caused the issue!

To get started, set up a personal Discord server for your Robo to hang out in and add your server's ID as a `DISCORD_GUILD_ID` env variable. Doing this unlocks the fab debugging features, plus the super-handy `/dev` command that gives you quick access to logs, system info, and more.

**➞** [📚 **Documentation:** Debugging](https://docs.roboplay.dev/docs/advanced/debugging)

## Configuration ⚙️

Robo.js automatically handles creating your Discord.js `Client` instance, but you can still configure what gets passed to it using the `config/robo.mjs` file. Use it to add more intents or change the behavior of other Robo.js features such as Sage.

The `.env` file contains your `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`. Keep these secret. You can get these values from the **[Discord Developer Portal](https://discord.com/developers/applications)**.

## Plugins 🔌

This Robo boasts an intuitive plugin system that grants new capabilities instantly!

```bash
npx robo add @robojs/ai
```

> Swap out [`@robojs/ai`](https://github.com/Wave-Play/robo.js/tree/main/packages/plugin-ai) with your chosen plugin's package name

With that, your Robo automatically equips itself with all the features the plugin offers. Want to revert? Simply use [`robo remove`](https://docs.roboplay.dev/docs/advanced/command-line#plugins) to uninstall any plugin.

**➞** [📚 **Documentation:** Installing plugins](https://docs.roboplay.dev/docs/advanced/plugins#installing-plugins)

Crafting something unique in your Robo project? You can turn your innovations into plugins, be it specific functionalities or your entire Robo. Share your genius with the world!

**➞** [📚 **Documentation:** Creating plugins](https://docs.roboplay.dev/docs/advanced/plugins#creating-plugins)

## Deployment 🚀

Run the `deploy` command to automatically deploy to **[RoboPlay](https://roboplay.dev)** once you're ready to keep your robo online 24/7.

```bash
npm run deploy
```

**➞** [🚀 **RoboPlay:** Hosting your Robo](https://docs.roboplay.dev/docs/hosting)

You can also self-host your robo anywhere that supports Node. Just make sure to run `build` followed by `start`:

```bash
npm run build
npm start
```

You can also run `invite` (beta) to automatically generate a server invite to test it yourself or show it off! You can also use the **[Discord Developer Portal](https://discord.com/developers/applications)** to generate an invite as usual.

```bash
npm run invite
```

Happy coding! 🎉

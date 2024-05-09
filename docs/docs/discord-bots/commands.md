import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# 📜 Commands

Slash commands have changed the game in Discord, making it a breeze for users to interact with bots (or as we like to call them, Robos). And with Robo.js, weaving your own slash commands is as easy as pie. Let's unravel this together!

## Crafting Simple Commands 🛠️

Start off with a simple command. Create a file in the `commands` directory. The file name? That's your command!

For instance, to create a `/ping` command, your file structure would look like this:

```plaintext
src/
└── commands/
    └── ping.js
```

And inside your `ping` command file? Straightforward:

<Tabs groupId="examples-script">
<TabItem value="js" label="Javascript">

```javascript title="commands/ping.js"
export default () => {
	return 'Pong!'
}
```

</TabItem>
<TabItem value="ts" label="Typescript">

```typescript title="commands/ping.ts"
import type { CommandResult } from 'robo.js'

export default (): CommandResult => {
	return 'Pong!'
}
```

</TabItem>
</Tabs>

To use the interaction object directly:
<Tabs groupId="examples-script">
<TabItem value="js" label="Javascript">

```javascript title="commands/ping.js"
export default (interaction) => {
	interaction.reply('Pong!')
}
```

</TabItem>
<TabItem value="ts" label="Typescript">

```typescript title="commands/ping.ts"
import type { CommandInteraction } from 'discord.js'

export default (interaction: CommandInteraction) => {
	interaction.reply('Pong!')
}
```

</TabItem>
</Tabs>

In this case, Sage steps back, letting you handle the interaction directly.

## Subcommands and Subcommand Groups 📚

Creating subcommands with Robo.js is as simple as creating new files in a folder. The folder name becomes the parent command, and the file names become the subcommands. But remember, you can't have a parent command file and subcommand files together.

```plaintext
src/
└── commands/
    └── ban/
        └── user.js
```

And subcommand groups? It's the same concept, but one level deeper. Again, parent commands or subcommands can't live alongside subcommand groups.

```plaintext
src/
└── commands/
    └── settings/
        └── update/
            └── something.js
```

## Customizing Commands 🖋️

Give your commands some context with descriptions. You can do this by exporting a `config` object from your command file.

```javascript
export const config = {
	description: 'Responds with Pong!'
}
```

For TypeScript users, you can add typings for both the `config` object and the command result.

```typescript title="commands/ping.ts"
import type { CommandConfig, CommandResult } from 'robo.js'

export const config: CommandConfig = {
	description: 'Responds with Pong!'
}

export default (): CommandResult => {
	return 'Pong!'
}
```

The `config` object also lets you customize stuff like locale translations, Sage options, and command timeouts. To understand more about the available configuration options, check out the [configuration section](/docs/advanced/configuration).

## Command Options 🎚️

Robo.js allows you to further customize your commands with options. You can define these options in your `config` object and then access their values in your command function.

<Tabs groupId="examples-script">
<TabItem value="js" label="Javascript">

```javascript title="commands/ping.js" {3-9} showLineNumbers
export const config = {
  description: 'Responds with Pong!',
  options: [
    {
      name: 'loud',
      description: 'Respond loudly?',
      type: 'boolean'
    }
  ]
}

export default (interaction) => {
  const loud = interaction.options.get('loud')?.value as boolean
  return loud ? 'PONG!!!' : 'Pong!'
}
```

</TabItem>
<TabItem value="ts" label="Typescript">

```javascript title="commands/ping.ts" {6-12} showLineNumbers
import type { CommandConfig, CommandResult } from 'robo.js'
import type { CommandInteraction } from 'discord.js'

export const config: CommandConfig = {
  description: 'Responds with Pong!',
  options: [
    {
      name: 'loud',
      description: 'Respond loudly?',
      type: 'boolean'
    }
  ]
}

export default (interaction: CommandInteraction): CommandResult => {
  const loud = interaction.options.get('loud')?.value as boolean
  return loud ? 'PONG!!!' : 'Pong!'
}
```

</TabItem>
</Tabs>

You can also use a second parameter next to the interaction object to access the options directly. These are automatically parsed and passed to your command function, with full type support too!

<Tabs groupId="examples-script">
<TabItem value="js" label="Javascript">

```javascript
export const config = {
	description: 'Responds with Pong!',
	options: [
		{
			name: 'loud',
			description: 'Respond loudly?',
			type: 'boolean'
		}
	]
}

export default (interaction, options) => {
	return options.loud ? 'PONG!!!' : 'Pong!'
}
```

</TabItem>
<TabItem value="ts" label="Typescript">

```typescript
import { createCommandConfig } from 'robo.js'
import type { CommandOptions, CommandResult } from 'robo.js'
import type { CommandInteraction } from 'discord.js'

export const config = createCommandConfig({
	description: 'Responds with Pong!',
	options: [
		{
			name: 'loud',
			description: 'Respond loudly?',
			type: 'boolean'
		}
	]
} as const)

export default (interaction: CommandInteraction, options: CommandOptions<typeof config>): CommandResult => {
	return options.loud ? 'PONG!!!' : 'Pong!'
}
```

> **Heads up!** `createCommandConfig` and `as const` are important for TypeScript! `createCommandConfig` creates a command configuration object with the correct type, which tells your editor which options are available for your command for better autocompletion and type checking.

</TabItem>
</Tabs>

Want to explore more options? Check the [configuration section](/docs/advanced/configuration).

### DM Permission

Control whether your command is accessible in direct messages with `dmPermission`. Setting this to `true` allows users to use the command in DMs with the bot, while `false` restricts it.

```javascript
export const config = {
	// ... other configuration options
	dmPermission: false // Restricts this command in DMs
}
```

### Default Member Permissions

Use `defaultMemberPermissions` to define server-based permissions for your command. This field accepts `PermissionFlagsBits` from Discord.js, allowing you to specify which roles or permissions are needed to access the command in a server context.

```javascript
import { PermissionFlagsBits } from 'discord.js'

export const config = {
	// ... other configuration options
	defaultMemberPermissions: PermissionFlagsBits.KickMembers // Only users who can kick members can use this command
}
```

:::warning

Remember, server admins can adjust these default permissions for their own servers. Also, due to a Discord quirk, default permissions might not apply as expected to subcommands.

:::

<!-- For a more comprehensive overview of command permissions in Discord, check out our [Permissions Guide](/docs/advanced/permissions). -->

## Autocomplete 🧠

Autocomplete can take your commands to the next level by providing suggestions as users type. You can implement autocomplete by exporting an `autocomplete` function in your command file.

<Tabs groupId="examples-script">
<TabItem value="js" label="Javascript">

```javascript showLineNumbers title="commands/choosa-a-color.js" {15-19}
export const config = {
	description: 'Chooses a color',
	options: [
		{
			name: 'color',
			description: 'Your favorite color',
			type: 'string',
			autocomplete: true
		}
	]
}

const colors = ['red', 'green', 'blue', 'yellow', 'black', 'white', 'pink', 'purple', 'brown']

export const autocomplete = (interaction) => {
	const colorQuery = interaction.options.get('color')?.value
	const filtered = colors.filter((color) => color.startsWith(colorQuery))
	return interaction.respond(filtered.map((colors) => ({ name: colors, value: colors })))
}

export default (interaction) => {
	return `You chose ${interaction.options.get('color')?.value}`
}
```

</TabItem>
<TabItem value="ts" label="Typescript">

```javascript showLineNumbers title="commands/choosa-a-color.ts" {18-22}
import type { CommandConfig, CommandResult } from 'robo.js'
import type { CommandInteraction, AutocompleteInteraction } from 'discord.js'

export const config: CommandConfig = {
  description: 'Chooses a color',
  options: [
    {
      name: 'color',
      description: 'Your favorite color',
      type: 'string',
      autocomplete: true
    }
  ]
}

const colors: Array<string> = ['red', 'green', 'blue', 'yellow', 'black', 'white', 'pink', 'purple', 'brown']

export const autocomplete = (interaction: AutocompleteInteraction) => {
  const colorQuery = interaction.options.get("color")?.value as string;
  const filtered = colors.filter((color) => color.startsWith(colorQuery));
  return interaction.respond(filtered.map((colors) => ({ name: colors, value: colors })));
};

export default (interaction: CommandInteraction): CommandResult => {
  return `You chose ${interaction.options.get('color')?.value}`
}
```

</TabItem>
</Tabs>

In this example, the `autocomplete` function returns an array of colors that start with the user's input, providing a dynamic and responsive user experience.

Note: the type of the Interaction is: `AutocompleteInteraction`

## Command Registration 📝

The cherry on top? You don't need to manually register your commands. Robo.js handles it for you when you run `robo dev` or `robo build`, automatically! However, if things go sideways for some reason, you can use the `--force` flag to force registration.

```bash
robo build --force
```

This will also clean up any commands that are no longer in your `commands` directory. Pretty neat, right?

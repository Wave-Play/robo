import type { CommandConfig } from 'robo.js'

export const config: CommandConfig = {
	description: 'Replies with Pong!'
}

export default () => {
	return 'Pong!'
}

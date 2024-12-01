import { logger } from 'robo.js'
import type { GuildQueue, Track } from 'discord-player'

export default (queue: GuildQueue, track: Track) => {
	logger.event('Player has started on queue', queue.id)
	logger.info('Track:', track?.title)
}

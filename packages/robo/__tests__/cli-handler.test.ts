import { Command } from '../src/cli/utils/cli-handler'

describe('CLI Handler Tests', () => {
	it('should correctly parse options after positional arguments', () => {
		const command = new Command('test-command')
		command.option('-v', '--verbose', 'Verbose output')

		const args = ['build', 'src/commands/ping.ts', '-v']
		const { options, positionalArgs } = command['parseOptions'](args)

		expect(options.verbose).toBe(true)
		expect(positionalArgs).toEqual(['build', 'src/commands/ping.ts'])
	})

	it('should return single string for options with spaces by default', () => {
		const command = new Command('test-command')
		command.option('-p', '--plugins', 'Plugins option', true)

		const args = ['--plugins', 'plugin-one', 'plugin-two']
		const { options } = command['parseOptions'](args)

		expect(options.plugins).toBe('plugin-one plugin-two')
	})

	it('should return array for options when returnArray is true', () => {
		const command = new Command('test-command')
		command.option('-p', '--plugins', 'Plugins option', true, true)

		const args = ['--plugins', 'plugin-one', 'plugin-two']
		const { options } = command['parseOptions'](args)

		expect(options.plugins).toEqual(['plugin-one', 'plugin-two'])
	})
})

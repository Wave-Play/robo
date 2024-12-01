import { cronLogger } from './loggers.js'
import { IS_BUN_RUNTIME } from './utils.js'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Cron as CronerJob } from 'croner'
import { color, Flashcore, getState, setState } from 'robo.js'
import { v4 as uuidv4 } from 'uuid'

const NAMESPACE = '__plugin_cron_'

class CronJob {
	private cronJob: CronerJob
	private id: string
	private path?: string
	private expression: string

	constructor(cronExpression: string, jobFunction: string | (() => void)) {
		this.id = uuidv4()
		this.expression = cronExpression

		if (typeof jobFunction === 'string') {
			this.path = jobFunction
			this.cronJob = new CronerJob(cronExpression, () => {
				this.executeFileBasedJob(jobFunction)
			})
		} else {
			this.cronJob = new CronerJob(cronExpression, jobFunction)
		}
	}

	private executeFileBasedJob(jobPath: string): void {
		try {
			let absolutePath = path.resolve(path.join(process.cwd(), '.robo', 'build', jobPath))
			cronLogger.debug(`Executing cron job handler: ${color.bold(jobPath)}`)

			if (!fs.existsSync(absolutePath) && absolutePath.endsWith('.js') && IS_BUN_RUNTIME) {
				absolutePath = absolutePath.replace(/\.js$/, '.ts')
			}

			if (fs.existsSync(absolutePath)) {
				const fileUrl = pathToFileURL(absolutePath).href
				import(fileUrl).then((module) => {
					if (typeof module.default === 'function') {
						module.default()
					} else {
						throw new Error(`Missing default export for job: ${color.bold(jobPath)}`)
					}
				})
			} else {
				cronLogger.error(`File ${color.bold(jobPath)} does not exist.`)
			}
		} catch (error) {
			cronLogger.error(error)
		}
	}

	async save(id?: string): Promise<string> {
		const jobId = id || this.id
		setState(`${jobId}`, this, { namespace: NAMESPACE })

		if (!this.path) {
			cronLogger.debug('Only file-based cron jobs can be saved.')
			return jobId
		}

		await Flashcore.set(jobId, { cron: this.expression, path: this.path }, { namespace: NAMESPACE })

		await Flashcore.set(
			'jobs',
			(jobs: string[] = []) => {
				if (!jobs.includes(jobId)) {
					jobs.push(jobId)
				}
				return jobs
			},
			{ namespace: NAMESPACE }
		)

		return jobId
	}

	pause(): void {
		this.cronJob.pause()
	}

	resume(): void {
		this.cronJob.resume()
	}

	stop(): void {
		this.cronJob.stop()
	}

	nextRun(): Date | null {
		return this.cronJob.nextRun()
	}
}

export function Cron(cronExpression: string, jobFunction: string | (() => void)): CronJob {
	return new CronJob(cronExpression, jobFunction)
}

Cron.get = (id: string): CronJob | null => {
	return getState(`${id}`, { namespace: NAMESPACE })
}

Cron.remove = async (id: string): Promise<void> => {
	await Flashcore.delete(id, { namespace: NAMESPACE })
	await Flashcore.set('jobs', (jobs: string[] = []) => jobs.filter((jobId) => jobId !== id), {
		namespace: NAMESPACE
	})

	setState(`${id}`, null, { namespace: NAMESPACE })
}

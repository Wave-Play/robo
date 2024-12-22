import { env } from './env.js'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { color, composeColors, logger } from 'robo.js'

const Repo = {
	Owner: env.get('github.repo').split('/')[0],
	Name: env.get('github.repo').split('/')[1]
}
export const RootDir = path.join(process.cwd(), '..')

export interface CommitData {
	commits: Array<{
		author: {
			email: string
			name: string
			username: string
		}
		committer: {
			email: string
			name: string
			username: string
		}
		distinct: boolean
		id: string
		message: string
		timestamp: string
		tree_id: string
		url: string
	}>
}

interface CommittedFile {
	additions: number
	blob_url: string
	changes: number
	contents_url: string
	deletions: number
	filename: string
	patch?: string
	raw_url: string
	sha: string
	status: string
}

interface Template {
	_links: {
		git: string
		html: string
		self: string
	}
	download_url: string | null
	git_url: string
	html_url: string
	name: string
	path: string
	sha: string
	size: number
	type: string
	url: string
}

/**
 *
 * @returns Promise<string[]>
 */

export async function getAllTemplates() {
	const paths = ['discord-activities', 'discord-bots', 'plugins', 'web-apps']
	const templates: string[] = []

	for (const path of paths) {
		const url = `https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/contents/templates/${path}`
		const response = await fetch(url, {
			headers: {
				Authorization: `token ${env.get('github.token')}`
			}
		})
		const data: Template[] = await response.json()
		logger.debug('Template path data:', data)
		templates.push(...data.filter((item) => item.type === 'dir').map((folder) => folder.path))
	}

	return templates
}

/**
 *
 * @param id
 * @returns Promise<CommittedFile[]>
 */

export async function getCommittedFiles(id: string) {
	const url = `https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/commits/${id}`
	const response = await fetch(url, {
		headers: {
			Authorization: `token ${env.get('github.token')}`
		}
	})

	const json = await response.json()
	const files: CommittedFile[] = json.files
	logger.debug('Committed files:', files)

	return files.filter((file) => {
		return file.filename.startsWith('templates')
	})
}

export async function filterCommitedTemplates(commitId: string, templates: string[]): Promise<Set<string> | undefined> {
	const committedFiles = await getCommittedFiles(commitId)

	if (committedFiles.length < 1) {
		logger.warn(`No committed files found for commit ${commitId}. Skipping...`)
		return
	}

	// Filter the templates to zip
	const templatesToZip: Set<string> = new Set(
		env.get('forceTemplates') === 'true'
			? templates
			: committedFiles.flatMap((file) => templates.filter((template) => file.filename.includes(template)))
	)

	return templatesToZip
}

type APIResponse = {
	name?: string
	path?: string
	sha?: string
	size?: number
	url?: string
	content?: string
	encoding?: string
	message?: string
	status?: string
	documentation_url?: string
}

/**
 *
 * @param branchName
 * @param commitSha : The commit sha is the sha of the main branch we base ourselves on.
 * @returns Promise<boolean>
 */
export async function createBranch(branchName: string, commitSha: string): Promise<APIResponse> {
	const url = `https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/git/refs`

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.get('github.token')}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			ref: `refs/heads/${branchName}`,
			sha: commitSha
		})
	})

	// to do, verify the error, if it is branch already created, then return true.x§x§
	const data = await response.json()
	if (response.ok) {
		logger.log('Branch created successfully:', data)
		return data
	} else {
		logger.warn(data.message)
		return data
	}
}

/**
 *
 * @returns Promise<string | undefined>
 */
export async function getBranchSha(): Promise<string | undefined> {
	const branch = 'main'

	const response = await fetch(`https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/git/ref/heads/${branch}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${env.get('github.token')}`
		}
	})

	const data = await response.json()
	if (response.ok) {
		logger.log('Commit SHA of the base branch:', data.object.sha)
		return data.object.sha // This is the SHA you'll use to create the new branch
	} else {
		logger.warn(data)
		return undefined
	}
}

/**
 *
 * @param filePath
 * @returns Promise<APIResponse>
 */
async function checkFileExist(filePath: string, branch: string): Promise<APIResponse> {
	const response = await fetch(
		`https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/contents${filePath}?ref=${branch}`,
		{
			method: 'GET',
			headers: {
				Authorization: `Bearer ${env.get('github.token')}`,
				Accept: 'application/vnd.github.v3+json'
			}
		}
	)

	const data = await response.json()

	return data
}

/**
 *
 * @param branch
 * @param filePath
 */

export async function uploadFileToGitHub(branch: string, filePath: string) {
	try {
		const relativePath = '/' + path.relative(RootDir, filePath)
		const fileContent = readFileSync(filePath, 'base64')
		logger.debug('File path:', filePath)
		logger.debug('Relative file path:', relativePath)

		const encodedContent = fileContent

		const fileExist = await checkFileExist(relativePath, branch)

		const fileSha = fileExist.sha

		if (fileSha) {
			logger.debug('File already exists... updating it.')
		}
		// the lack of / after contents is normal, its because it cannot start with a slash, so we re use the slash
		// of filePath
		const response = await fetch(`https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/contents${relativePath}`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${env.get('github.token')}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				message: 'chore(templates): updated robo dependencies',
				content: encodedContent,
				branch: branch,
				sha: fileExist ? fileExist.sha : null
			})
		})
		logger.debug('Request:', `https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/contents${relativePath}`, {
			message: 'chore(templates): updated robo dependencies',
			content: encodedContent,
			branch: branch,
			sha: fileExist ? fileExist.sha : null
		})

		// Handle the response
		const data = await response.json()
		if (response.ok) {
			logger.log('File uploaded successfully:', composeColors(color.bold, color.blue)(data.content.html_url))
		} else {
			logger.error('Error uploading file:', data)
		}
	} catch (error) {
		logger.error(error)
	}
}

/**
 *
 * @param title : This is the name of the PR
 * @param head  : The source branch where your changes are located.
 * @param base  : The target branch (e.g., main) you want to merge into.
 * @param body  : This is the description of the PR.
 * @returns Promise<Record<string, string> | undefined>
 */

export async function createPullRequest(title: string, head: string, base: string, body: string): Promise<APIResponse> {
	const response = await fetch(`https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/pulls`, {
		method: 'POST',
		headers: {
			Authorization: `token ${env.get('github.token')}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			title,
			head,
			base,
			body
		})
	})

	const data = await response.json()

	if (response.ok) {
		logger.log('Data: ', data)
		return data
	} else {
		logger.warn(data.errors[0].message)
		return data
	}
}

export {}
declare global {
	namespace NodeJS {
		interface ProcessEnv {
			B2_ACCOUNT_ID: string
			B2_APPLICATION_KEY: string
			B2_BUCKET: string
			FORCE_TEMPLATES: string
			GH_PUSH: string
			GH_TOKEN: string
			REPO_DATA: string
			ROBO_LOG_LEVEL: string
		}
	}
}

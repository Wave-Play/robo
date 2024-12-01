# @roboplay/plugin-ai

## 0.5.7

### Patch Changes

- 5a08d2a: refactor: cleaner debug logs
- 204ec0c: patch: account for unnecessary @ in function calls
- 6893fad: patch: mock entitlements in interaction
- Updated dependencies [1b84f8e]
  - robo.js@0.10.26
  - @robojs/server@0.6.2

## 0.5.6

### Patch Changes

- 8b0ce73: refactor: use gpt-4o as the new default
- Updated dependencies [4f6fdea]
- Updated dependencies [0770bac]
  - robo.js@0.10.16
  - @robojs/server@0.5.7

## 0.5.5

### Patch Changes

- 1520b9f: refactor: use gpt-4-turbo as default model
- 15fb940: patch: use correct response field in /chat command

## 0.5.4

### Patch Changes

- 99eb54a: patch: support for newer server plugin versions

## 0.5.3

### Patch Changes

- 26780ac: patch: better error logging for failed runs
- Updated dependencies [d6138ef]
  - robo.js@0.10.7
  - @robojs/server@0.4.5

## 0.5.2

### Patch Changes

- 79b9d17: feat: temperature control
- Updated dependencies [0113987]
- Updated dependencies [0748de7]
  - @robojs/server@0.4.5

## 0.5.1

### Patch Changes

- 60c8235: refactor: increased default poll delay to 1 second
- 60c8235: feat: new `pollDelay` option
- afdbefb: fix: command execution
- 6d532b8: patch: compatibility with robo.js automatic options extraction
- Updated dependencies [838ed5d]
- Updated dependencies [6a4473d]
- Updated dependencies [7490206]
- Updated dependencies [2bf83fe]
  - robo.js@0.10.6
  - @robojs/server@0.4.4

## 0.5.0

### Minor Changes

- fb1bfa4: refactor!: new package name
- 826433a: refactor!: use new robo.js package name

## 0.4.2

### Patch Changes

- 86cd358: feat: ability to restrict usage to certain channels
- 7eb543d: refactor: removed redundant colon in logger prefix

## 0.4.1

### Patch Changes

- 06da2f3: patch: do not pass request body to listAssistants API
- 514ec39: patch: better error handling for file uploads

## 0.4.0

### Minor Changes

- 7903fa3: refactor!: removed `openaiKey` plugin option
- 7903fa3: feat: support for components in natural language commands
- 7903fa3: feat: support for embeds and files in natural language commands
- 7903fa3: feat: new `/imagine` command
- 7903fa3: refactor: new engine-based model usage
- 7903fa3: feat: image generation capabilities
- 7903fa3: feat: use assistant api when insights enabled (default: true)
- 7903fa3: feat: new `/chat` command
- 7903fa3: feat: new `/ai say` command

### Patch Changes

- 7903fa3: patch: stable command options with natural language

## 0.3.0

### Minor Changes

- d14461d: feat: support for vision models

### Patch Changes

- a56d366: feat: "maxTokens" option

## 0.2.0

### Minor Changes

- e718a6b: feat: customize model to use via plugin options

### Patch Changes

- a2d6b09: chore: always include openai response errors in debug logs
- 1458e34: fix: handle empty commands converted to functions

## 0.1.0

### Minor Changes

- df72bf6: feat: plugin release

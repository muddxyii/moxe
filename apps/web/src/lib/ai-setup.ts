export function buildMoxieSetupPrompt(owner: string, name: string): string {
	return `You are setting up the repository "${owner}/${name}" to work with Moxie, a local-first agent orchestrator that runs multiple coding agents in parallel using isolated git worktrees.

## What you need to create

Create a \`.moxie/\` directory at the repository root with the following files:

### 1. \`.moxie/config.json\`
\`\`\`json
{
  "init": "./.moxie/init.sh",
  "cleanup": "./.moxie/cleanup.sh"
}
\`\`\`

### 2. \`.moxie/init.sh\`
This script runs inside each new git worktree BEFORE the coding agent starts. It must prepare the worktree to be a fully functional, isolated development environment.

### 3. \`.moxie/cleanup.sh\`
This script runs when an agent is archived/cleaned up. It should tear down any resources created by init.sh.

Both scripts must be executable (\`chmod +x\`).

## Environment variables available to your scripts

| Variable | Description |
|---|---|
| MOXIE_ISSUE_NUMBER | GitHub issue number |
| MOXIE_ISSUE_TITLE | GitHub issue title |
| MOXIE_BRANCH | Branch name for this worktree |
| MOXIE_WORKTREE_PATH | Absolute path to the worktree |
| MOXIE_ROOT_PATH | Absolute path to the main repo |
| MOXIE_WORKSPACE_NAME | Normalized workspace identifier (e.g. \`issue-42-add-auth\`) |
| MOXIE_PORT_BASE | First port in the allocated block |
| MOXIE_PORT_API | Port base + 0 |
| MOXIE_PORT_WEB | Port base + 1 |
| MOXIE_PORT_DB | Port base + 2 |

## What init.sh typically needs to do

Each git worktree is a full copy of the repo on its own branch. The init script must make it independently runnable. Common tasks:

1. **Install dependencies** — Use \`--frozen-lockfile\` (or equivalent) to ensure consistent versions across worktrees: \`npm ci\`, \`pnpm install --frozen-lockfile\`, \`pip install -r requirements.txt\`, etc.
2. **Generate .env files** — Use MOXIE_PORT_* variables so each worktree uses isolated ports. For secrets, copy from the main repo: \`cp "\${MOXIE_ROOT_PATH}/.env.local" "\${MOXIE_WORKTREE_PATH}/.env.local"\` — never hardcode secrets in scripts.
3. **Start isolated databases** — If the project uses a database, spin up a Docker container with a unique name and port:
   \`\`\`bash
   docker run -d --name "moxie-pg-\${MOXIE_WORKSPACE_NAME}" -p "\${MOXIE_PORT_DB}:5432" -e POSTGRES_PASSWORD=dev postgres:16-alpine
   \`\`\`
4. **Run migrations** — Against the workspace-specific database
5. **Configure dev server ports** — Some frameworks use \`PORT\` env var, others need flags (e.g. \`next dev -p $PORT\`) or \`package.json\` patches. Make sure the dev server binds to the allocated port.
6. **Copy/generate config files** — Any project-specific configuration
7. **Seed data** — If the project needs seed data to function

## What cleanup.sh typically needs to do

Moxie handles removing the worktree directory itself — your cleanup script only needs to tear down external resources that init.sh created.

1. **Stop and remove Docker containers** — \`docker stop "moxie-pg-\${MOXIE_WORKSPACE_NAME}" && docker rm "moxie-pg-\${MOXIE_WORKSPACE_NAME}"\`
2. **Release external resources** — Database connections, API sessions, etc.
3. **Clean up out-of-worktree artifacts** — Anything init.sh created outside the worktree directory (temp files, sockets, etc.)

## Instructions

1. **Examine this repository thoroughly** — Look at package.json, docker-compose.yml, Makefile, existing scripts, .env.example, README, and any other configuration to understand what this project needs to run
2. **Identify all dependencies and services** — What needs to be installed? Does it use a database? Message queue? External services?
3. **Ask the user questions** if anything is ambiguous or can't be inferred from the codebase:
   - What database does each worktree need? (shared or isolated?)
   - Are there any services that should be shared across worktrees vs isolated?
   - How should secrets/credentials be propagated? (copy from main repo, symlink, vault, etc.)
   - Any build steps that take a long time and could be optimized?
   If the project is straightforward (e.g. a simple web app with no DB/Docker), skip the questions and just write the scripts.
4. **Write the scripts** — Create \`.moxie/config.json\`, \`.moxie/init.sh\`, and \`.moxie/cleanup.sh\`
5. **Make them executable** — \`chmod +x .moxie/init.sh .moxie/cleanup.sh\`

## Important notes

- The \`.moxie/\` directory and its scripts **should be committed** to the repo so all contributors can use Moxie.
- The goal is full isolation. Multiple agents running simultaneously should never conflict with each other on ports, databases, or file locks.`;
}

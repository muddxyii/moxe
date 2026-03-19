# Moxie

Local-first agent orchestrator for running multiple Claude Code agents in parallel. Each agent works in its own git worktree, scoped to a GitHub Issue.

See `docs/spec.md` for the full spec.

## Stack

- **Runtime**: Node.js (not Bun — node-pty native addon compatibility is critical)
- **API**: Hono on port 3456
- **Frontend**: SvelteKit (static adapter, served by Hono in production)
- **ORM**: Drizzle with SQLite via better-sqlite3
- **Database**: SQLite at `~/.moxie/moxie.db`
- **Terminal**: XTerm.js + node-pty over WebSocket
- **GitHub**: gh CLI (no Octokit, no custom API client)
- **Styling**: Tailwind + shadcn-svelte
- **Package manager**: pnpm (monorepo with workspaces)

## Project structure

```
moxie/
├── packages/db/          # Drizzle schema, client, migrations
├── apps/server/          # Hono API server
└── apps/web/             # SvelteKit frontend
```

## Commands

```bash
pnpm dev                           # Start all dev servers via Turbo
pnpm --filter @moxie/server dev    # Start API server only (port 3456)
pnpm --filter @moxie/web dev       # Start SvelteKit dev server only (port 5173)
pnpm build                         # Build all packages via Turbo
pnpm lint                          # Lint with Biome
pnpm lint:fix                      # Auto-fix lint issues
pnpm format                        # Format with Biome
pnpm typecheck                     # TypeScript check via Turbo
pnpm db:generate                   # Generate Drizzle migration after schema changes
pnpm db:migrate                    # Run migrations
```

## Architecture

- **Two DB tables**: `agents` and `events`. Agent status is derived from the latest event — never stored as a column.
- **Event-driven state**: append-only `events` table. Use `deriveStatus()` from `@moxie/db` to get current status.
- **Auto-migration**: the db client runs migrations on import. No manual migration step needed during dev.
- **Modular schema**: schema files live at `packages/db/src/schema/`. One file per table.
- **Server imports from `@moxie/db` only**: never import `drizzle-orm` or `better-sqlite3` directly in server code. All query helpers (`eq`, `desc`, etc.) are re-exported from `@moxie/db`.

## DB schema

### agents table
id, repo, issueNumber, issueTitle, issueBody, branch, worktreePath, logPath, pid, portBase, prNumber, prUrl, createdAt, finishedAt

### events table
id, agentId, type, payload, ts

### Event types
`queued`, `worktree_created`, `ports_allocated`, `init_start`, `init_done`, `init_failed`, `agent_start`, `agent_done`, `agent_failed`, `pr_created`, `issue_closed`, `killed`

## Key patterns

- **No `.js` extensions in imports** within `packages/db/` — drizzle-kit uses CJS require internally and chokes on them.
- **Biome for linting and formatting** — no ESLint or Prettier. Tabs, recommended rules, `node:` protocol for Node builtins.
- **Turbo for task orchestration** — `pnpm dev`, `pnpm build`, `pnpm typecheck` all go through Turbo.
- **Shared TypeScript configs** in `tooling/typescript/` — `base.json` for apps, `internal-package.json` for packages.
- **Port management**: each workspace gets 10 consecutive ports from `~/.moxie/port-allocations.json`. Offsets: +0 API, +1 Web, +2 DB, +3 Test, +4-9 reserved.
- **Per-project config**: target repos have a `.moxie/` directory with `config.json`, `init.sh`, `cleanup.sh`, and optional `ports.json`.
- **Global state**: `~/.moxie/` holds `moxie.db`, `port-allocations.json`, `worktrees/`, and optional `config.json`.
- **Terminal output**: written to `<worktree>/agent.log`, not stored in DB. Streamed live via WebSocket, backfilled from log file on reconnect.
- **Killed agent branches**: preserved by default. Worktree removed from disk, branch stays for inspection.
- **No run history**: re-running an issue creates a new agent row. Old row stays, old worktree is cleaned up.
- **PR bodies**: comprehensive, scaled by change size (summary only for small, full context for large). Agent generates the content. Always includes `Closes #<n>`.

## Environment variables for init/cleanup scripts

MOXIE_ISSUE_NUMBER, MOXIE_ISSUE_TITLE, MOXIE_BRANCH, MOXIE_WORKTREE_PATH, MOXIE_ROOT_PATH, MOXIE_WORKSPACE_NAME, MOXIE_PORT_BASE, MOXIE_PORT_API, MOXIE_PORT_WEB, MOXIE_PORT_DB

## Conventions

- GitHub operations always go through `gh` CLI, never Octokit
- No auth, no accounts, no cloud sync — single user, local machine
- Prefer simplicity over configurability

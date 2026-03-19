# Agent Orchestrator

**MVP Specification — v3**

| | |
|---|---|
| **Version** | 0.3 |
| **Stack** | Node + Hono + SvelteKit + Drizzle + SQLite + XTerm.js |
| **Target** | macOS (primary), Linux (secondary) |
| **Scope** | Solo developer, local machine only |

---

## 1. Purpose

A lightweight, local-first web app for running multiple Claude Code agents in parallel. Each agent works in its own git worktree, scoped to a GitHub Issue. The app handles init, cleanup, monitoring, and PR creation — leaving the developer to review output, not manage terminals.

No cloud sync. No auth. No database server. State lives in a local SQLite file. The UI runs in a browser tab.

## 2. Goals

### In scope for MVP

- Pick one or more GitHub Issues and launch an agent per issue
- Each agent runs in an isolated git worktree on its own branch
- Run init.sh before the agent starts, cleanup.sh when it finishes
- Embedded terminal (XTerm.js) per agent — watch it work in real time
- Sidebar showing all running agents and their status at a glance
- On completion: open a PR linked to the source issue, then close the issue
- Diff viewer to review agent changes before merging
- Kill an agent and clean up its worktree at any time
- Port management — each workspace gets isolated ports for API, web, DB, etc.
- Database isolation — each workspace can run its own Postgres container

### Out of scope for MVP

- Team features, cloud sync, or multi-machine support
- Auth or user accounts of any kind
- Windows support
- Support for agents other than Claude Code
- Automatic merging — human always reviews the diff first
- Run history — each agent is a one-shot; re-running creates a fresh agent
- Mobile access — architecture supports it, implementation is post-MVP

## 3. Stack

Every choice optimises for simplicity and local-first operation. Nothing requires a network connection except GitHub API calls via the gh CLI.

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js | Proven native addon support — critical for node-pty reliability |
| API server | Hono | Lightweight, fast, minimal boilerplate. Serves API routes + static files |
| Frontend | SvelteKit | Nicer reactivity model for live-updating state, less boilerplate than React |
| ORM | Drizzle | Type-safe queries, lightweight, works natively with SQLite |
| Database | SQLite via better-sqlite3 | Zero config, no server, persists state across restarts |
| Terminal | XTerm.js + node-pty | Battle-tested, same approach as VS Code's integrated terminal |
| GitHub | gh CLI | Handles auth, issues, PRs — no custom API client needed |
| Styling | Tailwind + shadcn-svelte | Svelte-native component library, consistent quality |
| Transport | WebSockets (ws) | Stream terminal output and agent status to the browser |
| Package manager | pnpm | Fast, disk-efficient, strict dependency resolution |

### Why Node over Bun

node-pty is a native C++ addon. Bun's native addon compatibility is improving but not reliable enough for a product where PTY is the core feature. Node's N-API support is rock solid. We use pnpm as the package manager for speed.

### Why Hono over Express

Express is battle-tested but heavy for what we need. Hono is ~14kb, has native WebSocket support, and its middleware pattern is cleaner. It runs on Node without issues.

### Why not Tauri / Electron

The terminal is the hard part of any native app. Both Tauri and Electron require bridging PTY management across a process boundary — Rust FFI in Tauri's case, IPC in Electron's. A local web server with WebSockets handles PTY streaming more naturally, and a browser tab is lighter than either runtime. Acceptable tradeoff for a solo developer tool.

## 4. Architecture

### Process model

One Node server process manages everything. Hono serves the API and static files. It owns the SQLite database (via Drizzle), the PTY instances, and the WebSocket connections to the browser. The SvelteKit frontend is built to static files and served by Hono in production.

```
Browser (SvelteKit)
     |  WebSocket — terminal output, agent status
     |  HTTP — issue list, start/stop agent, diff data
     v
Node + Hono Server
     |  node-pty — spawns Claude Code per worktree
     |  Drizzle + better-sqlite3 — agent state
     |  child_process — git, gh CLI, init/cleanup scripts
     v
Filesystem
     |  SQLite DB — ~/.moxie/moxie.db
     |  Port registry — ~/.moxie/port-allocations.json
     |  Worktrees — ~/.moxie/worktrees/<workspace-name>/
     |  Logs — <worktree>/agent.log
```

### Data model (SQLite via Drizzle)

Two tables. Status is derived from the latest event — no sync problems between a status column and an event log.

Schema is defined in modular files: `src/db/schema/agents.ts`, `src/db/schema/events.ts`.

#### agents

One row per agent. Represents both the task (GitHub issue) and the execution context (worktree, PTY).

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const agents = sqliteTable('agents', {
  id:            text('id').primaryKey(),           // nanoid
  repo:          text('repo').notNull(),             // owner/repo
  issueNumber:   integer('issue_number').notNull(),
  issueTitle:    text('issue_title').notNull(),
  issueBody:     text('issue_body'),
  branch:        text('branch').notNull(),
  worktreePath:  text('worktree_path').notNull(),
  logPath:       text('log_path'),                   // <worktree>/agent.log
  pid:           integer('pid'),
  portBase:      integer('port_base'),               // first port in allocated block
  prNumber:      integer('pr_number'),
  prUrl:         text('pr_url'),
  createdAt:     text('created_at').notNull(),
  finishedAt:    text('finished_at'),
});
```

#### events

Append-only log. The latest event for an agent determines its current status.

```typescript
export const events = sqliteTable('events', {
  id:       text('id').primaryKey(),               // nanoid
  agentId:  text('agent_id').notNull().references(() => agents.id),
  type:     text('type').notNull(),                // EventType enum
  payload:  text('payload'),                       // JSON string, optional
  ts:       text('ts').notNull(),
});
```

#### Event types and derived status

```typescript
type EventType =
  | 'queued'
  | 'worktree_created'
  | 'ports_allocated'
  | 'init_start'    | 'init_done'    | 'init_failed'
  | 'agent_start'    | 'agent_done'    | 'agent_failed'
  | 'cleanup_start' | 'cleanup_done' | 'cleanup_failed'
  | 'pr_created'     | 'issue_closed'
  | 'killed';

// Derived status mapping:
// queued           → pending (gray)
// worktree_created → pending (gray)
// ports_allocated  → pending (gray)
// init_start      → setting up (blue)
// init_done       → setting up (blue)
// agent_start      → running (blue pulse)
// agent_done       → completing (green)
// cleanup_start   → tearing down (yellow)
// cleanup_done    → done (green)
// pr_created       → done (green)
// issue_closed     → done (green)
// *_failed         → failed (red)
// killed           → killed (orange)
```

#### Why no run history

Re-running an issue creates a new agent row. The old row stays in the DB but the worktree is cleaned up. This is simpler than a tasks/runs split and matches how you'd actually use the tool — if an agent fails, you fix the issue description and try again fresh.

### Terminal output storage

Terminal output is written to `<worktree>/agent.log` as a raw file, not stored in the DB. This keeps SQLite lean, survives restarts, and gets cleaned up automatically when the worktree is removed. The `logPath` column on the agents table points to it.

While the agent is running, output streams live via WebSocket. If you reconnect after a disconnect, the server reads the tail of the log file to backfill the terminal.

### Agent lifecycle

Each agent moves through a linear sequence. Any step can fail, which triggers cleanup.

```
queued → worktree_created → ports_allocated → init_start → init_done → agent_start → agent_done
                                                                                           │
         ┌───────────────────────────────────────────────────────────────────────────────────┘
         v
    cleanup_start → cleanup_done → pr_created → issue_closed
```

On failure at any step:
```
*_failed → cleanup_start → cleanup_done
```

On kill:
```
killed → cleanup_start → cleanup_done
```

- **queued** — agent is queued for launch
- **worktree_created** — `git worktree add` creates an isolated branch at `~/.moxie/worktrees/<workspace-name>`
- **ports_allocated** — port block reserved from `port-allocations.json`
- **init_start/done** — init.sh runs inside the new worktree
- **agent_start/done** — Claude Code spawns with the issue as context, PTY streams to XTerm.js
- **cleanup_start/done** — cleanup.sh runs, then `git worktree remove`, then ports deallocated
- **pr_created** — `gh pr create` opens a PR linked to the issue
- **issue_closed** — `gh issue close` marks the issue done

## 5. UI

### Layout

Three-column layout. Sidebar on the left for agent list, main area in the centre for the active terminal or diff, optional detail panel on the right for issue metadata.

```
+------------------+----------------------------------+--------------+
| Agents           | Terminal / Diff                   | Issue detail |
|                  |                                  |              |
| [#42] Running  > | $ claude --issue 42 ...          | Title        |
| [#87] Setup      | > Writing auth middleware...     | Body         |
| [#103] Done      | > Running tests...               | Labels       |
|                  |                                  | Assignee     |
| + New agent      |                         [Kill]   |              |
+------------------+----------------------------------+--------------+
```

### Sidebar — agent list

- Issue number and truncated title
- Status badge: pending (gray), setting up (blue), running (blue pulse), done (green), failed (red), killed (orange)
- Click to switch the main area to that agent
- Keyboard shortcut: Cmd+1 through Cmd+9 to jump to agent by position

### Main area — terminal

- Full XTerm.js instance, keyboard passthrough enabled
- Scrollback buffer of 10,000 lines
- Toggle between terminal view and diff view per agent
- Kill button — confirms before sending SIGTERM, then runs cleanup

### Main area — diff viewer

- Available once the agent finishes
- File tree on the left, unified diff on the right
- Syntax highlighted — shiki for static rendering
- **Inline editing** — pencil icon toggles between read-only diff and editable mode. Lets you make quick fixes before committing.
- Open in editor button — passes file path to $EDITOR or VS Code
- Create PR button — triggers gh pr create flow

### New agent flow

- Click + New agent in the sidebar
- Search box fetches open issues via `gh issue list`, filtered as you type
- Select one or more issues — each becomes a separate agent
- Confirm — agents launch immediately, each in its own worktree

## 6. GitHub Integration

All GitHub operations go through the gh CLI. No Octokit, no personal access tokens managed by the app — the user handles `gh auth login` once and the app inherits those credentials.

| Operation | Command | When |
|---|---|---|
| List open issues | `gh issue list --state open --json number,title,body,labels` | New agent modal, refreshed on open |
| Fetch issue detail | `gh issue view <number> --json number,title,body,assignees,labels` | Agent start |
| Create PR | `gh pr create --title "Fix #<n>: <title>" --body <generated> --base main` | Agent completes successfully |
| Close issue | `gh issue close <number>` | After PR is created |
| Link PR to issue | Included in PR body as `Closes #<n>` | GitHub autolinks on merge |

### Issue as agent context

When Claude Code spawns, the issue title and body are passed as the initial prompt. The agent works on a branch named `feature/issue-<number>-<slug>` inside its own worktree. It has no awareness of other running agents.

```
claude --print "Fix the following GitHub issue:\n\nTitle: <title>\n\n<body>"
```

## 7. Per-Project Configuration

### The `.moxie/` directory

Each project that uses Moxie has a `.moxie/` directory at its repository root. This is how Moxie discovers and configures projects — if `.moxie/config.json` exists, the repo is Moxie-enabled.

```
your-project/
├── .moxie/
│   ├── config.json          # Project configuration
│   ├── ports.json           # Per-project port definitions (optional)
│   ├── init.sh             # Init entry point
│   ├── cleanup.sh          # Cleanup entry point
│   └── lib/                 # Optional shared utilities
│       └── common.sh        # Helpers for init/cleanup
├── src/
└── ...
```

### config.json

```json
{
  "init": "./.moxie/init.sh",
  "cleanup": "./.moxie/cleanup.sh"
}
```

Config lives per-project because each project has different init needs. A Node project needs `npm install`, a Python project needs `pip install`, a Rust project needs `cargo build`. The scripts know what to do.

### ports.json (optional)

Per-project port definitions. Each worktree gets these ports allocated from the available range.

```json
[
  { "port": 0, "label": "API" },
  { "port": 1, "label": "Web" },
  { "port": 2, "label": "Postgres" },
  { "port": 3, "label": "Playwright" }
]
```

Port values are offsets from the allocated base. If no `ports.json` exists, Moxie uses the default offsets (API +0, Web +1, DB +2).

### Global state

Moxie's own state lives at `~/.moxie/`:

```
~/.moxie/
├── moxie.db                       # SQLite database
├── port-allocations.json         # Port registry with file locking
├── worktrees/                    # All worktrees live here
│   ├── issue-42-add-auth/
│   ├── issue-87-fix-login/
│   └── ...
└── config.json                   # Global settings (optional)
```

Global `~/.moxie/config.json` (optional overrides):

```json
{
  "scriptTimeout": 300,
  "portRangeStart": 4000,
  "portsPerWorkspace": 10
}
```

### Environment variables available to scripts

| Variable | Value |
|---|---|
| MOXIE_ISSUE_NUMBER | GitHub issue number |
| MOXIE_ISSUE_TITLE | GitHub issue title |
| MOXIE_BRANCH | Branch name for this worktree |
| MOXIE_WORKTREE_PATH | Absolute path to the worktree |
| MOXIE_ROOT_PATH | Absolute path to the main repo |
| MOXIE_WORKSPACE_NAME | Normalized workspace identifier (e.g. `issue-42-add-auth`) |
| MOXIE_PORT_BASE | First port in the allocated block (e.g. `4000`) |
| MOXIE_PORT_API | Port base + 0 (convenience) |
| MOXIE_PORT_WEB | Port base + 1 (convenience) |
| MOXIE_PORT_DB | Port base + 2 (convenience) |

`MOXIE_WORKSPACE_NAME` is derived from the branch name, normalized to lowercase alphanumeric with hyphens, max 32 chars. Useful for naming containers, database branches, or port allocations in init scripts.

### Execution rules

- Setup runs inside the worktree directory, after `git worktree add` and port allocation, before Claude Code spawns
- Teardown runs after Claude Code exits, regardless of success or failure
- Both scripts time out after 5 minutes (configurable via global `scriptTimeout`)
- stdout and stderr are captured and shown in the run log
- A non-zero exit from init aborts the agent → `init_failed` event
- A non-zero exit from cleanup is logged but does not affect agent status
- Scripts must be executable (`chmod +x`). Moxie checks this at agent start and warns if not.

## 8. Port Management

Each workspace gets isolated ports so multiple agents can run full-stack environments (API server, web dev server, database, etc.) simultaneously without collisions.

### Allocation model

Each workspace gets a block of 10 consecutive ports from a base (default: 4000). Allocations are tracked in `~/.moxie/port-allocations.json` with file-based locking to prevent races between concurrent agent startups.

```
Workspace A: ports 4000–4009
Workspace B: ports 4010–4019
Workspace C: ports 4020–4029
```

### Port offset conventions

| Offset | Service | Example (base 4000) |
|---|---|---|
| +0 | API server (Hono, Express, etc.) | 4000 |
| +1 | Web dev server (Vite, SvelteKit, etc.) | 4001 |
| +2 | Database (Postgres, MySQL container) | 4002 |
| +3 | Test runner / Playwright | 4003 |
| +4–9 | Reserved for project-specific use | 4004–4009 |

Projects define which offsets they use. The convention is a suggestion — init scripts can use any port in their allocated block.

### Port allocation file

```json
{
  "allocations": {
    "issue-42-add-auth": { "base": 4000, "agentId": "abc123", "allocatedAt": "2026-03-16T10:00:00Z" },
    "issue-87-fix-login": { "base": 4010, "agentId": "def456", "allocatedAt": "2026-03-16T10:01:00Z" }
  },
  "nextBase": 4020
}
```

### Locking

Port allocation uses `mkdir`-based locking. `mkdir` is atomic on POSIX — if the directory already exists, the call fails, acting as a mutex.

```bash
LOCK_DIR="$HOME/.moxie/.port-lock"

acquire_lock() {
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do sleep 0.1; done
}

release_lock() {
  rmdir "$LOCK_DIR"
}
```

Moxie handles allocation in the server before init scripts run. The allocated port base is passed via environment variables.

### Database isolation

For projects that need a database per workspace, init scripts should:

1. **Start an isolated container** named after the workspace:
   ```bash
   docker run -d \
     --name "moxie-pg-${MOXIE_WORKSPACE_NAME}" \
     -p "${MOXIE_PORT_DB}:5432" \
     -e POSTGRES_DB="myapp_${MOXIE_WORKSPACE_NAME}" \
     -e POSTGRES_PASSWORD=dev \
     postgres:16-alpine
   ```

2. **Wait for readiness** before running migrations:
   ```bash
   until pg_isready -h localhost -p "${MOXIE_PORT_DB}" -q; do sleep 0.5; done
   ```

3. **Run migrations** against the workspace-specific URL:
   ```bash
   DATABASE_URL="postgresql://postgres:dev@localhost:${MOXIE_PORT_DB}/myapp_${MOXIE_WORKSPACE_NAME}" \
     npm run db:migrate
   ```

Teardown stops and removes the container:
```bash
docker stop "moxie-pg-${MOXIE_WORKSPACE_NAME}" 2>/dev/null || true
docker rm "moxie-pg-${MOXIE_WORKSPACE_NAME}" 2>/dev/null || true
```

### .env generation

Setup scripts write workspace-specific `.env` files using the allocated ports:

```bash
cat > .env <<EOF
PORT=${MOXIE_PORT_API}
DATABASE_URL=postgresql://postgres:dev@localhost:${MOXIE_PORT_DB}/myapp_${MOXIE_WORKSPACE_NAME}
WEB_URL=http://localhost:${MOXIE_PORT_WEB}
EOF

# For Vite projects that read from their own root
cat > packages/web/.env <<EOF
VITE_API_URL=http://localhost:${MOXIE_PORT_API}
VITE_PORT=${MOXIE_PORT_WEB}
EOF
```

### Shared services

Some services (like MinIO/S3) can be shared across workspaces on fixed ports. These should be started once (not per-workspace) and referenced in init scripts. Moxie doesn't manage shared services — that's left to the project's init scripts.

### Cleanup

- Teardown deallocates the port block from `port-allocations.json`
- On startup, Moxie scans for stale allocations (agent no longer exists) and reclaims them
- Ports are also reclaimed when an agent is killed

## 9. Mobile Access (post-MVP)

### Approach

Inspired by [yepanywhere](https://github.com/kzahel/yepanywhere). Instead of building a responsive mobile UI (terminals are unusable on phones), Moxie will provide remote monitoring and control via an encrypted relay.

### How it works

```
Phone browser ←→ Encrypted relay ←→ Moxie server (your machine)
                 (SRP-6a + NaCl)
```

- **End-to-end encrypted** — the relay server cannot read your data
- **No accounts** — pairing via QR code or one-time code displayed in the Moxie UI
- **Agent keeps running** when you disconnect — processes are server-side
- **Push notifications** via browser Push API when an agent finishes, fails, or needs approval

### Mobile UI (status-only)

- List of all agents with status badges
- Tap to see recent log output (last 100 lines, not a full terminal)
- Kill button per agent
- Notification when agent completes → tap to view diff summary
- **No terminal interaction** — read-only monitoring

### Self-hosted alternative

- Tailscale: expose Moxie's port to your tailnet, access from phone via Tailscale IP
- Caddy: reverse proxy with automatic SSL for a custom domain

### MVP scope

Mobile access is post-MVP. The architecture supports it (WebSocket-based transport, stateless browser client), but the relay integration and pairing flow come later.

## 10. Project structure

```
moxie/
├── package.json
├── pnpm-workspace.yaml
├── packages/
│   └── db/
│       ├── src/
│       │   ├── schema/
│       │   │   ├── agents.ts
│       │   │   ├── events.ts
│       │   │   └── index.ts
│       │   ├── client.ts
│       │   └── index.ts
│       ├── drizzle/              # migrations
│       └── drizzle.config.ts
├── apps/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts          # Hono app entry
│   │   │   ├── routes/
│   │   │   │   ├── agents.ts     # CRUD + lifecycle
│   │   │   │   ├── issues.ts     # gh CLI wrapper
│   │   │   │   └── diff.ts       # git diff data
│   │   │   ├── services/
│   │   │   │   ├── pty.ts        # node-pty manager
│   │   │   │   ├── worktree.ts   # git worktree ops
│   │   │   │   ├── ports.ts      # port allocation + locking
│   │   │   │   ├── lifecycle.ts  # agent state machine
│   │   │   │   └── github.ts     # gh CLI calls
│   │   │   └── ws/
│   │   │       └── terminal.ts   # WebSocket handler
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── routes/           # SvelteKit pages
│       │   ├── lib/
│       │   │   ├── components/   # UI components
│       │   │   ├── stores/       # Svelte stores
│       │   │   └── types.ts      # Shared types
│       │   └── app.html
│       ├── svelte.config.js
│       └── package.json
```

Monorepo with pnpm workspaces. The `db` package is shared between server and (potentially) any future packages. The server and web app are separate packages under `apps/`.

Per-project config (`.moxie/`) lives in the user's target repo, not in this monorepo.

## 11. Build Plan

Iterative — each phase produces something usable.

| Phase | Deliverable |
|---|---|
| 1 — Skeleton | pnpm monorepo, Drizzle schema + migrations, Hono server serving a hello world, SvelteKit app building to static |
| 2 — Core loop | node-pty spawning Claude Code, WebSocket streaming to XTerm.js in browser, agent row created in DB, events appended as lifecycle progresses |
| 3 — Git worktrees | `git worktree add/remove` into `~/.moxie/worktrees/`, branch naming, worktree cleanup on kill/failure |
| 4 — Port management | Port allocation service, `port-allocations.json`, locking, env var injection, stale allocation cleanup on startup |
| 5 — GitHub integration | `gh issue list` in new agent modal, issue passed as context, `gh pr create` + `gh issue close` on completion |
| 6 — Init / cleanup | Config file parsing, script execution with env vars (including ports), timeout handling, output captured to log |
| 7 — UI | Three-column layout, status badges, agent switching, keyboard shortcuts. Tailwind + shadcn-svelte |
| 8 — Diff viewer | File tree, unified diff with syntax highlighting via shiki, open in editor, create PR button |
| 9 — Polish | Error states, orphan worktree cleanup on startup, reconnect/backfill from log file, queue management |

### Non-goals that may become goals later

- Mobile access via encrypted relay (yepanywhere-inspired)
- Tauri wrapper — add after the web app is stable if an app feel becomes important
- Multiple repo support — config file per repo, switch via UI
- Agent templates — saved prompts beyond the issue body
- Notifications — system notification when an agent finishes
- Multiple agent types — Codex, Gemini, etc.

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| node-pty crashes or leaks file descriptors under load | Low | node-pty is mature. Cap maxParallel at a sane default. Monitor with process.on('exit') cleanup. |
| gh CLI not installed or not authenticated | Medium | Check at startup, show clear error with instructions if missing. |
| Agent produces a huge diff that crashes the diff viewer | Low | Paginate diffs, cap at 1,000 lines rendered, link to raw file for the rest. |
| Worktree cleanup fails, leaving orphaned branches | Medium | Archive always attempts `git worktree remove`. Orphan detection on startup offers to clean up. |
| Port collisions between workspaces | Low | Centralized allocation with file locking. Stale allocation cleanup on startup. |
| Docker not installed for DB-dependent projects | Medium | Init script checks for Docker, fails with clear error. Not all projects need it — only those whose init.sh uses containers. |
| SvelteKit + Hono integration friction | Low | SvelteKit builds to static adapter. Hono just serves the files. No SSR coupling. |

## 13. Resolved Decisions

| Question | Decision |
|---|---|
| PR body content | Comprehensive — summary, why/context, how it works, testing, risks. Scaled by change size. |
| Killed agent branch cleanup | **Preserved by default**. Worktree removed from disk, branch stays for inspection. Opt-in deletion flag in the UI. |
| maxParallel | **No limit**. Each agent gets its own worktree, no throttling. |
| Diff viewer editing | **Inline editing**. Pencil icon toggles read-only ↔ edit mode in the diff view. |
| Port range config | **Per-project** via `.moxie/ports.json`. Each worktree can define port entries. Global fallback via `~/.moxie/config.json`. |

### PR body format

PRs are created with a structured body, scaled to the size of the change:

**Small changes:**
```markdown
## Summary
- <1-3 bullets>

Closes #<n>
```

**Standard changes:**
```markdown
## Summary
- <what changed>

## Why / Context
<why this exists, what problem it solves>

## How It Works
<brief approach explanation>

## Testing
<automated tests run, commands executed>

Closes #<n>
```

**High-risk changes:**
```markdown
## Summary
- <what changed>

## Why / Context
<why this exists, what problem it solves>

## How It Works
<brief approach explanation>

## Manual QA
<specific scenarios validated, edge cases>

## Testing
<automated tests run, commands executed>

## Risks / Rollback
<only when change has meaningful risk>

Closes #<n>
```

The agent generates the PR body content. The format is proportionate — no filler, no N/A padding.
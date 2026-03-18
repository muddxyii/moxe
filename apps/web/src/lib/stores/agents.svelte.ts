import { fetchAgents, fetchRepos } from "$lib/api";
import type { Agent, AgentStatus, Repo, WorkspaceGroup } from "$lib/types";

let agents = $state<Agent[]>([]);
let repos = $state<Repo[]>([]);
let loading = $state(true);
let showCompleted = $state(false);
let pollInterval: ReturnType<typeof setInterval> | null = null;

const ACTIVE_STATUSES: Set<AgentStatus> = new Set([
	"pending",
	"setting_up",
	"running",
]);

const workspaceGroups = $derived(() => {
	const groups: WorkspaceGroup[] = [];
	for (const repo of repos) {
		const repoKey = `${repo.owner}/${repo.name}`;
		const repoAgents = agents.filter((a) => a.repo === repoKey);
		groups.push({
			workspaceId: repoKey,
			label: repo.name,
			owner: repo.owner,
			name: repo.name,
			localPath: repo.localPath,
			activeAgents: repoAgents.filter((a) => ACTIVE_STATUSES.has(a.status)),
			completedAgents: repoAgents.filter((a) => !ACTIVE_STATUSES.has(a.status)),
		});
	}
	return groups;
});

async function refresh() {
	try {
		[agents, repos] = await Promise.all([fetchAgents(), fetchRepos()]);
	} catch {
		// toast already shown by api client
	} finally {
		loading = false;
	}
}

function startPolling() {
	refresh();
	pollInterval = setInterval(refresh, 3000);
}

function stopPolling() {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}

function toggleCompleted() {
	showCompleted = !showCompleted;
}

export function getAgentStore() {
	return {
		get agents() {
			return agents;
		},
		get repos() {
			return repos;
		},
		get loading() {
			return loading;
		},
		get workspaceGroups() {
			return workspaceGroups();
		},
		get showCompleted() {
			return showCompleted;
		},
		startPolling,
		stopPolling,
		refreshAgents: refresh,
		toggleCompleted,
	};
}

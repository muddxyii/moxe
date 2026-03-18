import { fetchAgents } from "$lib/api";
import type { Agent, AgentStatus, WorkspaceGroup } from "$lib/types";

let agents = $state<Agent[]>([]);
let loading = $state(true);
let showCompleted = $state(false);
let pollInterval: ReturnType<typeof setInterval> | null = null;

const ACTIVE_STATUSES: Set<AgentStatus> = new Set([
	"pending",
	"setting_up",
	"running",
]);

const agentsGroupedByRepo = $derived(() => {
	const groups = new Map<string, Agent[]>();
	for (const agent of agents) {
		const list = groups.get(agent.repo) ?? [];
		list.push(agent);
		groups.set(agent.repo, list);
	}
	return groups;
});

const workspaceGroups = $derived(() => {
	const groupMap = new Map<string, WorkspaceGroup>();
	for (const agent of agents) {
		let group = groupMap.get(agent.repo);
		if (!group) {
			group = {
				workspaceId: agent.repo,
				label: agent.repo,
				activeAgents: [],
				completedAgents: [],
			};
			groupMap.set(agent.repo, group);
		}
		if (ACTIVE_STATUSES.has(agent.status)) {
			group.activeAgents.push(agent);
		} else {
			group.completedAgents.push(agent);
		}
	}
	return Array.from(groupMap.values());
});

async function refreshAgents() {
	try {
		agents = await fetchAgents();
	} catch {
		// toast already shown by api client
	} finally {
		loading = false;
	}
}

function startPolling() {
	refreshAgents();
	pollInterval = setInterval(refreshAgents, 3000);
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
		get loading() {
			return loading;
		},
		get grouped() {
			return agentsGroupedByRepo();
		},
		get workspaceGroups() {
			return workspaceGroups();
		},
		get showCompleted() {
			return showCompleted;
		},
		startPolling,
		stopPolling,
		refreshAgents,
		toggleCompleted,
	};
}

import { fetchAgents } from "$lib/api";
import type { Agent } from "$lib/types";

let agents = $state<Agent[]>([]);
let loading = $state(true);
let pollInterval: ReturnType<typeof setInterval> | null = null;

const agentsGroupedByRepo = $derived(() => {
	const groups = new Map<string, Agent[]>();
	for (const agent of agents) {
		const list = groups.get(agent.repo) ?? [];
		list.push(agent);
		groups.set(agent.repo, list);
	}
	return groups;
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
		startPolling,
		stopPolling,
		refreshAgents,
	};
}

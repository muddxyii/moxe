import { getAgentStore } from "./agents.svelte";

let selectedAgentId = $state<string | null>(null);

const selectedAgent = $derived(() => {
	const store = getAgentStore();
	if (!selectedAgentId) return null;
	return store.agents.find((a) => a.id === selectedAgentId) ?? null;
});

// Clear selection when agent disappears from the list (e.g. archived/removed)
$effect(() => {
	const store = getAgentStore();
	if (selectedAgentId && store.agents.length > 0 && !store.loading) {
		const exists = store.agents.some((a) => a.id === selectedAgentId);
		if (!exists) {
			selectedAgentId = null;
		}
	}
});

export function getSelectionStore() {
	return {
		get selectedAgentId() {
			return selectedAgentId;
		},
		get selectedAgent() {
			return selectedAgent();
		},
		selectAgent(id: string) {
			selectedAgentId = id;
		},
		clearSelection() {
			selectedAgentId = null;
		},
	};
}

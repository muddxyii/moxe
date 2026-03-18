import { getAgentStore } from "./agents.svelte";

let selectedAgentId = $state<string | null>(null);

const selectedAgent = $derived(() => {
	const store = getAgentStore();
	if (!selectedAgentId) return null;
	return store.agents.find((a) => a.id === selectedAgentId) ?? null;
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

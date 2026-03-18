import { getAgentStore } from "./agents.svelte";

type AgentSelection = { type: "agent"; id: string };
type ShellSelection = { type: "shell"; owner: string; name: string };
type Selection = AgentSelection | ShellSelection | null;

let selection = $state<Selection>(null);

const selectedAgent = $derived(() => {
	if (selection?.type !== "agent") return null;
	const id = selection.id;
	const store = getAgentStore();
	return store.agents.find((a) => a.id === id) ?? null;
});

export function getSelectionStore() {
	return {
		get selection() {
			return selection;
		},
		get selectedAgentId() {
			return selection?.type === "agent" ? selection.id : null;
		},
		get selectedAgent() {
			return selectedAgent();
		},
		selectAgent(id: string) {
			selection = { type: "agent", id };
		},
		selectShell(owner: string, name: string) {
			selection = { type: "shell", owner, name };
		},
		clearSelection() {
			selection = null;
		},
	};
}

<script lang="ts">
import { shellWsUrl, terminalWsUrl } from "$lib/api";
import CenterTopBar from "$lib/components/center/CenterTopBar.svelte";
import EmptyState from "$lib/components/center/EmptyState.svelte";
import DiffViewer from "$lib/components/diff/DiffViewer.svelte";
import Terminal from "$lib/components/terminal/Terminal.svelte";
import { getSelectionStore } from "$lib/stores/selection.svelte";

let mode = $state<"terminal" | "changes">("terminal");

const selectionStore = getSelectionStore();
const selection = $derived(selectionStore.selection);
const agent = $derived(selectionStore.selectedAgent);

$effect(() => {
	if (agent?.id) {
		mode = "terminal";
	}
});
</script>

<div class="flex h-full flex-col bg-[var(--background)]">
	{#if selection?.type === "shell"}
		{#key `${selection.owner}/${selection.name}`}
			<Terminal wsUrl={shellWsUrl(selection.owner, selection.name)} />
		{/key}
	{:else if selection?.type === "agent" && agent}
		<CenterTopBar
			{agent}
			{mode}
			onModeChange={(m: "terminal" | "changes") => (mode = m)}
		/>
		<div class="flex-1 overflow-hidden">
			{#if mode === "terminal"}
				{#key agent.id}
					<Terminal wsUrl={terminalWsUrl(agent.id)} />
				{/key}
			{:else}
				<DiffViewer agentId={agent.id} {agent} />
			{/if}
		</div>
	{:else}
		<EmptyState />
	{/if}
</div>

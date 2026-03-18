<script lang="ts">
import CenterTopBar from "$lib/components/center/CenterTopBar.svelte";
import EmptyState from "$lib/components/center/EmptyState.svelte";
import DiffViewer from "$lib/components/diff/DiffViewer.svelte";
import Terminal from "$lib/components/terminal/Terminal.svelte";
import { getSelectionStore } from "$lib/stores/selection.svelte";

let mode = $state<"terminal" | "changes">("terminal");

const selectionStore = getSelectionStore();
const agent = $derived(selectionStore.selectedAgent);

$effect(() => {
	if (selectionStore.selectedAgentId) {
		mode = "terminal";
	}
});
</script>

<div class="flex h-full flex-col bg-[var(--background)]">
	{#if !agent}
		<EmptyState />
	{:else}
		<CenterTopBar
			{agent}
			{mode}
			onModeChange={(m: "terminal" | "changes") => (mode = m)}
		/>
		<div class="flex-1 overflow-hidden">
			{#if mode === "terminal"}
				{#key agent.id}
					<Terminal agentId={agent.id} />
				{/key}
			{:else}
				<DiffViewer agentId={agent.id} {agent} />
			{/if}
		</div>
	{/if}
</div>

<script lang="ts">
import { getSelectionStore } from "$lib/stores/selection.svelte";

let showNewAgent = $state(false);
let showSettings = $state(false);

const selectionStore = getSelectionStore();
const agent = $derived(selectionStore.selectedAgent);
</script>

<ThreePanel>
	{#snippet left()}
		<AgentList
			onNewAgent={() => (showNewAgent = true)}
			onSettings={() => (showSettings = true)}
		/>
	{/snippet}

	{#snippet center()}
		<CenterPanel />
	{/snippet}

	{#snippet right()}
		{#if agent}
			<IssueDetail {agent} />
		{:else}
			<div class="flex h-full items-center justify-center p-4 text-sm text-[var(--ctp-subtext0)]">
				Select an agent to view details
			</div>
		{/if}
	{/snippet}
</ThreePanel>

{#if showNewAgent}
	<NewAgentModal onClose={() => (showNewAgent = false)} />
{/if}

{#if showSettings}
	<SettingsModal onClose={() => (showSettings = false)} />
{/if}

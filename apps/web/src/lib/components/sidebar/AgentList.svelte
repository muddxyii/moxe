<script lang="ts">
	import { onMount } from "svelte";
	import { getAgentStore } from "$lib/stores/agents.svelte";
	import { getSelectionStore } from "$lib/stores/selection.svelte";
	import RepoGroup from "./RepoGroup.svelte";

interface Props {
	onNewAgent: () => void;
	onSettings: () => void;
}

let { onNewAgent, onSettings }: Props = $props();

const agentStore = getAgentStore();
const selectionStore = getSelectionStore();

onMount(() => {
	agentStore.startPolling();
	return () => agentStore.stopPolling();
});

function handleKeydown(e: KeyboardEvent) {
	if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
		e.preventDefault();
		const index = Number.parseInt(e.key, 10) - 1;
		const allAgents = agentStore.agents;
		if (index < allAgents.length) {
			selectionStore.selectAgent(allAgents[index].id);
		}
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col bg-[var(--sidebar)]">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--border)] px-3 py-3">
		<span class="text-sm font-semibold text-[var(--ctp-text)]">Agents</span>
		<button
			class="rounded p-1 text-[var(--ctp-subtext0)] transition-colors hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
			onclick={onSettings}
			title="Settings"
		>
			<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
				<path
					d="M7.07 0c-.473 0-.88.33-.97.793L5.77 2.5a5.97 5.97 0 00-1.272.734L2.9 2.67a1.001 1.001 0 00-1.1.428L.73 4.9a1 1 0 00.13 1.22l1.272 1.1a6.07 6.07 0 000 1.56L.86 9.88a1 1 0 00-.13 1.22l1.07 1.8a1 1 0 001.1.428l1.597-.563c.39.29.816.54 1.272.734l.33 1.707c.09.463.497.793.97.793h2.14c.473 0 .88-.33.97-.793l.33-1.707a5.97 5.97 0 001.272-.734l1.597.563a1 1 0 001.1-.428l1.07-1.8a1 1 0 00-.13-1.22l-1.272-1.1a6.07 6.07 0 000-1.56l1.272-1.1a1 1 0 00.13-1.22l-1.07-1.8a1.001 1.001 0 00-1.1-.428l-1.597.563A5.97 5.97 0 009.49 2.5l-.33-1.707A1.001 1.001 0 008.19 0H7.07zM8 5.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"
				/>
			</svg>
		</button>
	</div>

	<!-- Agent list -->
	<div class="flex-1 overflow-y-auto py-2">
		{#if agentStore.loading}
			{#each Array(4) as _}
				<div class="px-3 py-2">
					<div class="skeleton mb-2 h-4 w-3/4"></div>
					<div class="skeleton h-3 w-1/2"></div>
				</div>
			{/each}
		{:else if agentStore.grouped.size === 0}
			<div class="px-3 py-8 text-center text-sm text-[var(--ctp-subtext0)]">
				No agents yet. Create one to get started.
			</div>
		{:else}
			{#each [...agentStore.grouped] as [repo, agents] (repo)}
				<RepoGroup
					{repo}
					{agents}
					selectedAgentId={selectionStore.selectedAgentId}
					onSelect={(id) => selectionStore.selectAgent(id)}
				/>
			{/each}
		{/if}
	</div>

	<!-- New Agent button -->
	<div class="border-t border-[var(--border)] p-3">
		<button
			class="w-full rounded-md bg-[var(--ctp-surface0)] px-3 py-2 text-sm font-medium text-[var(--ctp-text)] transition-colors hover:bg-[var(--ctp-surface1)]"
			onclick={onNewAgent}
		>
			+ New Agent
		</button>
	</div>
</div>

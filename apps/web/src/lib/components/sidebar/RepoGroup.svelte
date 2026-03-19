<script lang="ts">
import AgentRow from "$lib/components/sidebar/AgentRow.svelte";
import ShellRow from "$lib/components/sidebar/ShellRow.svelte";
import type { WorkspaceGroup } from "$lib/types";

interface Props {
	workspace: WorkspaceGroup;
	showCompleted: boolean;
	selectedAgentId: string | null;
	shellActive: boolean;
	onSelectAgent: (id: string) => void;
	onSelectShell: () => void;
	onNewAgent: (workspace: WorkspaceGroup) => void;
}

let {
	workspace,
	showCompleted,
	selectedAgentId,
	shellActive,
	onSelectAgent,
	onSelectShell,
	onNewAgent,
}: Props = $props();

let collapsed = $state(false);
const activeCount = $derived(workspace.activeAgents.length);
const completedCount = $derived(workspace.completedAgents.length);
</script>

<div class="mb-2">
	<div class="mb-1 flex items-center px-2 py-1">
		<button
			class="flex flex-1 items-center gap-1 text-left text-sm text-[var(--ctp-subtext0)] transition-colors hover:text-[var(--ctp-text)]"
			onclick={() => (collapsed = !collapsed)}
		>
			<svg class="h-3 w-3 transition-transform" class:rotate-[-90deg]={collapsed} viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 4.5l3 3 3-3" />
			</svg>
			<span class="truncate">{workspace.label} ({activeCount + completedCount})</span>
		</button>
		<button
			class="ml-1 flex h-5 w-5 items-center justify-center rounded text-[var(--ctp-subtext0)] transition-colors hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
			onclick={() => onNewAgent(workspace)}
			title="New agent"
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
				<path d="M7 2v10M2 7h10" />
			</svg>
		</button>
	</div>

	{#if !collapsed}
		<div class="space-y-1">
			<ShellRow active={shellActive} onclick={onSelectShell} />

			{#each workspace.activeAgents as agent (agent.id)}
				<AgentRow
					{agent}
					active={agent.id === selectedAgentId}
					onclick={() => onSelectAgent(agent.id)}
				/>
			{/each}

			{#if showCompleted && completedCount > 0}
				<div class="px-3 pt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--ctp-overlay1)]">Completed</div>
				{#each workspace.completedAgents as agent (agent.id)}
					<AgentRow
						{agent}
						active={agent.id === selectedAgentId}
						onclick={() => onSelectAgent(agent.id)}
						dimmed
					/>
				{/each}
			{/if}
		</div>
	{/if}
</div>

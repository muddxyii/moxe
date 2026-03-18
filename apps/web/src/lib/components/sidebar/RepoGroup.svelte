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

const hasActiveAgents = $derived(workspace.activeAgents.length > 0);
const hasCompletedAgents = $derived(workspace.completedAgents.length > 0);
</script>

<div class="mb-1">
	<div class="flex w-full items-center px-3 py-2">
		<button
			class="flex-1 text-left text-xs font-semibold uppercase tracking-wider text-[var(--ctp-subtext0)] hover:text-[var(--ctp-text)]"
			onclick={() => (collapsed = !collapsed)}
		>
			{workspace.label}
		</button>
		<div class="flex items-center gap-0.5">
			<button
				class="flex h-5 w-5 items-center justify-center rounded text-[var(--ctp-subtext0)] transition-colors hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
				onclick={() => onNewAgent(workspace)}
				title="New agent"
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
					<path d="M7 2v10M2 7h10" />
				</svg>
			</button>
			<button
				class="flex h-5 w-5 items-center justify-center rounded text-[var(--ctp-subtext0)] transition-colors hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
				onclick={() => (collapsed = !collapsed)}
				title={collapsed ? "Expand" : "Collapse"}
			>
				<svg
					class="h-3.5 w-3.5 transition-transform"
					class:rotate-[-90deg]={collapsed}
					viewBox="0 0 12 12"
					fill="currentColor"
				>
					<path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" />
				</svg>
			</button>
		</div>
	</div>

	{#if !collapsed}
		<div class="flex flex-col gap-0.5 px-1">
			<!-- Shell entry always at top -->
			<ShellRow active={shellActive} onclick={onSelectShell} />

			{#if hasActiveAgents}
				<div class="mx-3 my-1 border-t border-[var(--ctp-surface0)]"></div>
			{/if}

			{#each workspace.activeAgents as agent (agent.id)}
				<AgentRow
					{agent}
					active={agent.id === selectedAgentId}
					onclick={() => onSelectAgent(agent.id)}
				/>
			{/each}

			{#if showCompleted && hasCompletedAgents}
				<div class="mx-3 my-1 border-t border-[var(--ctp-surface0)]"></div>
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

<script lang="ts">
import AgentRow from "$lib/components/sidebar/AgentRow.svelte";
import type { Agent } from "$lib/types";

interface Props {
	repo: string;
	agents: Agent[];
	completedAgents: Agent[];
	showCompleted: boolean;
	selectedAgentId: string | null;
	onSelect: (id: string) => void;
}

let {
	repo,
	agents,
	completedAgents,
	showCompleted,
	selectedAgentId,
	onSelect,
}: Props = $props();

let collapsed = $state(false);

const hasActiveAgents = $derived(agents.length > 0);
const hasCompletedAgents = $derived(completedAgents.length > 0);
</script>

<div class="mb-1">
	<button
		class="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ctp-subtext0)] hover:text-[var(--ctp-text)]"
		onclick={() => (collapsed = !collapsed)}
	>
		<svg
			class="h-3 w-3 transition-transform"
			class:rotate-[-90deg]={collapsed}
			viewBox="0 0 12 12"
			fill="currentColor"
		>
			<path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" />
		</svg>
		{repo}
	</button>

	{#if !collapsed}
		<div class="flex flex-col gap-0.5 px-1">
			{#each agents as agent (agent.id)}
				<AgentRow
					{agent}
					active={agent.id === selectedAgentId}
					onclick={() => onSelect(agent.id)}
				/>
			{/each}

			{#if showCompleted && hasCompletedAgents}
				{#if hasActiveAgents}
					<div class="mx-3 my-1 border-t border-[var(--ctp-surface0)]"></div>
				{/if}
				{#each completedAgents as agent (agent.id)}
					<AgentRow
						{agent}
						active={agent.id === selectedAgentId}
						onclick={() => onSelect(agent.id)}
						dimmed
					/>
				{/each}
			{/if}
		</div>
	{/if}
</div>

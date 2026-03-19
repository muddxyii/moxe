<script lang="ts">
import type { Agent } from "$lib/types";
import { timeAgo, truncate } from "$lib/utils";

interface Props {
	agent: Agent;
	active: boolean;
	onclick: () => void;
	dimmed?: boolean;
}

let { agent, active, onclick, dimmed = false }: Props = $props();

const statusColorByState: Record<string, string> = {
	queued: "var(--ctp-yellow)",
	starting: "var(--ctp-yellow)",
	running: "var(--ctp-blue)",
	done: "var(--ctp-green)",
	failed: "var(--ctp-red)",
	cancelled: "var(--ctp-overlay1)",
};

const statusColor = $derived(
	statusColorByState[agent.status] ?? "var(--ctp-lavender)",
);
</script>

<button
	class="group relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors {active
		? 'bg-[var(--ctp-surface1)]'
		: 'hover:bg-[var(--ctp-surface0)]'}"
	class:opacity-55={dimmed && !active}
	{onclick}
	title={`#${agent.issueNumber} ${agent.issueTitle}`}
>
	{#if active}
		<div class="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-[var(--ctp-lavender)]"></div>
	{/if}
	<div class="min-w-0 flex-1">
		<div class="truncate text-sm font-medium text-[var(--ctp-text)]">
			{truncate(agent.issueTitle, 30)}
		</div>
		<div class="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--ctp-subtext0)]">
			<span>#{agent.issueNumber}</span>
			<span class="text-[var(--ctp-overlay1)]">•</span>
			<span>{timeAgo(agent.createdAt)}</span>
		</div>
	</div>
	<div class="h-2.5 w-2.5 rounded-full" style={`background-color: ${statusColor};`}></div>
</button>

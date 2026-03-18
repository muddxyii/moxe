<script lang="ts">
import StatusBadge from "$lib/components/sidebar/StatusBadge.svelte";
import type { Agent } from "$lib/types";
import { timeAgo, truncate } from "$lib/utils";

interface Props {
	agent: Agent;
	active: boolean;
	onclick: () => void;
	dimmed?: boolean;
}

let { agent, active, onclick, dimmed = false }: Props = $props();
</script>

<button
	class="flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--ctp-surface0)]"
	class:bg-[var(--ctp-surface1)]={active}
	class:opacity-60={dimmed && !active}
	{onclick}
>
	<div class="flex items-center justify-between gap-2">
		<span class="text-sm font-medium text-[var(--ctp-text)]">
			<span class="text-[var(--ctp-subtext0)]">#{agent.issueNumber}</span>
			{truncate(agent.issueTitle, 28)}
		</span>
	</div>
	<div class="flex items-center justify-between">
		<StatusBadge status={agent.status} />
		<span class="text-xs text-[var(--ctp-subtext0)]">{timeAgo(agent.createdAt)}</span>
	</div>
</button>

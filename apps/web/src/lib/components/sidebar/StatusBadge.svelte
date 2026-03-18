<script lang="ts">
import type { AgentStatus } from "$lib/types";

interface Props {
	status: AgentStatus;
}

let { status }: Props = $props();

const colorMap: Record<AgentStatus, string> = {
	pending: "var(--ctp-overlay2)",
	setting_up: "var(--ctp-blue)",
	running: "var(--ctp-blue)",
	completed: "var(--ctp-green)",
	archiving: "var(--ctp-teal)",
	archive_failed: "var(--ctp-peach)",
	failed: "var(--ctp-red)",
	killed: "var(--ctp-peach)",
};

const labelMap: Record<AgentStatus, string> = {
	pending: "Pending",
	setting_up: "Setting up",
	running: "Running",
	completed: "Completed",
	archiving: "Archiving",
	archive_failed: "Archive failed",
	failed: "Failed",
	killed: "Killed",
};

const shouldPulse = $derived(status === "running" || status === "archiving");
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
	style="color: {colorMap[status]};"
>
	<span
		class="inline-block h-2 w-2 rounded-full"
		class:pulse-animation={shouldPulse}
		style="background-color: {colorMap[status]};"
	></span>
	{labelMap[status]}
</span>

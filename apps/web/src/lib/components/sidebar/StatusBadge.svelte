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
	completing: "var(--ctp-teal)",
	tearing_down: "var(--ctp-teal)",
	done: "var(--ctp-green)",
	failed: "var(--ctp-red)",
	killed: "var(--ctp-peach)",
};

const labelMap: Record<AgentStatus, string> = {
	pending: "Pending",
	setting_up: "Setting up",
	running: "Running",
	completing: "Completing",
	tearing_down: "Tearing down",
	done: "Done",
	failed: "Failed",
	killed: "Killed",
};

const shouldPulse = $derived(status === "running" || status === "tearing_down");
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

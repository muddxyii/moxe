<script lang="ts">
import { killAgent } from "$lib/api";
import { getAgentStore } from "$lib/stores/agents.svelte";
import type { Agent } from "$lib/types";

interface Props {
	agent: Agent;
	mode: "terminal" | "changes";
	onModeChange: (mode: "terminal" | "changes") => void;
}

let { agent, mode, onModeChange }: Props = $props();

let confirmingKill = $state(false);
const agentStore = getAgentStore();

const isRunning = $derived(
	["pending", "setting_up", "running", "completing", "tearing_down"].includes(
		agent.status,
	),
);

async function handleKill() {
	if (!confirmingKill) {
		confirmingKill = true;
		setTimeout(() => (confirmingKill = false), 3000);
		return;
	}
	await killAgent(agent.id);
	confirmingKill = false;
	agentStore.refreshAgents();
}
</script>

<div
	class="flex items-center justify-between border-b border-[var(--border)] bg-[var(--ctp-mantle)] px-4 py-2"
>
	<div class="flex items-center gap-2 text-sm">
		<span class="text-[var(--ctp-subtext0)]">#{agent.issueNumber}</span>
		<span class="font-medium text-[var(--ctp-text)]">{agent.issueTitle}</span>
	</div>

	<div class="flex items-center gap-2">
		<!-- Mode toggle -->
		<div class="flex rounded-md bg-[var(--ctp-surface0)] p-0.5">
			<button
				class="rounded px-3 py-1 text-xs font-medium transition-colors"
				class:bg-[var(--ctp-surface1)]={mode === "terminal"}
				class:text-[var(--ctp-text)]={mode === "terminal"}
				class:text-[var(--ctp-subtext0)]={mode !== "terminal"}
				onclick={() => onModeChange("terminal")}
			>
				Terminal
			</button>
			<button
				class="rounded px-3 py-1 text-xs font-medium transition-colors"
				class:bg-[var(--ctp-surface1)]={mode === "changes"}
				class:text-[var(--ctp-text)]={mode === "changes"}
				class:text-[var(--ctp-subtext0)]={mode !== "changes"}
				onclick={() => onModeChange("changes")}
			>
				Changes
			</button>
		</div>

		<!-- Kill button -->
		{#if isRunning}
			<button
				class="rounded-md px-3 py-1 text-xs font-medium transition-colors {confirmingKill ? 'bg-[var(--ctp-red)] text-[var(--ctp-crust)]' : 'bg-[var(--ctp-surface0)] text-[var(--ctp-red)] hover:bg-[var(--ctp-red)] hover:text-[var(--ctp-crust)]'}"
				onclick={handleKill}
			>
				{confirmingKill ? "Confirm Kill" : "Kill"}
			</button>
		{/if}

		<!-- PR link -->
		{#if agent.prUrl}
			<a
				href={agent.prUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-md bg-[var(--ctp-green)] px-3 py-1 text-xs font-medium text-[var(--ctp-crust)] transition-opacity hover:opacity-80"
			>
				PR #{agent.prNumber}
			</a>
		{/if}
	</div>
</div>

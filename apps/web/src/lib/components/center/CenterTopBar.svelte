<script lang="ts">
import { archiveAgent, killAgent } from "$lib/api";
import { getAgentStore } from "$lib/stores/agents.svelte";
import type { Agent } from "$lib/types";

interface Props {
	agent: Agent;
	mode: "terminal" | "changes";
	onModeChange: (mode: "terminal" | "changes") => void;
}

let { agent, mode, onModeChange }: Props = $props();

let confirmingKill = $state(false);
let archiving = $state(false);
const agentStore = getAgentStore();

const canKill = $derived(
	["pending", "setting_up", "running"].includes(agent.status),
);

const canArchive = $derived(
	["completed", "failed", "killed", "archive_failed"].includes(agent.status),
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

async function handleArchive() {
	archiving = true;
	try {
		await archiveAgent(agent.id);
		agentStore.refreshAgents();
	} finally {
		archiving = false;
	}
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

		<!-- Archive button -->
		{#if canArchive}
			<button
				class="rounded-md bg-[var(--ctp-surface0)] px-3 py-1 text-xs font-medium text-[var(--ctp-green)] transition-colors hover:bg-[var(--ctp-green)] hover:text-[var(--ctp-crust)] disabled:opacity-50"
				onclick={handleArchive}
				disabled={archiving}
			>
				{archiving ? "Archiving..." : "Archive"}
			</button>
		{/if}

		<!-- Kill button -->
		{#if canKill}
			<button
				class="rounded-md px-3 py-1 text-xs font-medium transition-colors {confirmingKill ? 'bg-[var(--ctp-red)] text-[var(--ctp-crust)]' : 'bg-[var(--ctp-surface0)] text-[var(--ctp-red)] hover:bg-[var(--ctp-red)] hover:text-[var(--ctp-crust)]'}"
				onclick={handleKill}
			>
				{confirmingKill ? "Confirm Kill" : "Kill"}
			</button>
		{/if}

	</div>
</div>

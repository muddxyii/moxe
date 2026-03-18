<script lang="ts">
import { archiveAgent, fetchAgent, killAgent } from "$lib/api";
import EventTimeline from "$lib/components/detail/EventTimeline.svelte";
import MarkdownRenderer from "$lib/components/detail/MarkdownRenderer.svelte";
import DiffViewer from "$lib/components/diff/DiffViewer.svelte";
import { getAgentStore } from "$lib/stores/agents.svelte";
import type { Agent, AgentEvent } from "$lib/types";

interface Props {
	agent: Agent;
}

let { agent }: Props = $props();

let mode = $state<"terminal" | "changes">("terminal");
let events = $state<AgentEvent[]>([]);
let loading = $state(true);
let currentAgentId = $state<string | null>(null);
let confirmingKill = $state(false);
let archiving = $state(false);

const agentStore = getAgentStore();

const canKill = $derived(
	["pending", "setting_up", "running"].includes(agent.status),
);
const canArchive = $derived(
	["completed", "failed", "killed", "archive_failed"].includes(agent.status),
);

async function loadDetail(id: string, showLoading = false) {
	if (showLoading) loading = true;
	try {
		const detail = await fetchAgent(id);
		events = detail.events ?? [];
	} catch {
		// toast shown by api client
	} finally {
		loading = false;
	}
}

$effect(() => {
	const id = agent.id;
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	if (id !== currentAgentId) {
		currentAgentId = id;
		mode = "terminal";
		loadDetail(id, true);
	} else {
		loadDetail(id);
	}
	pollInterval = setInterval(() => loadDetail(id), 5000);
	return () => {
		if (pollInterval) clearInterval(pollInterval);
	};
});

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

<div class="flex h-full flex-col overflow-hidden">
	<!-- Toggle + Actions header -->
	<div
		class="flex items-center justify-between border-b border-[var(--border)] bg-[var(--ctp-mantle)] px-3 py-2 flex-shrink-0"
	>
		<div class="flex rounded-md bg-[var(--ctp-surface0)] p-0.5">
			<button
				class="rounded px-3 py-1 text-xs font-medium transition-colors"
				class:bg-[var(--ctp-surface1)]={mode === "terminal"}
				class:text-[var(--ctp-text)]={mode === "terminal"}
				class:text-[var(--ctp-subtext0)]={mode !== "terminal"}
				onclick={() => (mode = "terminal")}
			>Terminal</button>
			<button
				class="rounded px-3 py-1 text-xs font-medium transition-colors"
				class:bg-[var(--ctp-surface1)]={mode === "changes"}
				class:text-[var(--ctp-text)]={mode === "changes"}
				class:text-[var(--ctp-subtext0)]={mode !== "changes"}
				onclick={() => (mode = "changes")}
			>Changes</button>
		</div>
		<div class="flex items-center gap-2">
			{#if canArchive}
				<button
					class="rounded-md bg-[var(--ctp-surface0)] px-3 py-1 text-xs font-medium text-[var(--ctp-green)] transition-colors hover:bg-[var(--ctp-green)] hover:text-[var(--ctp-crust)] disabled:opacity-50"
					onclick={handleArchive}
					disabled={archiving}
				>{archiving ? "Archiving..." : "Archive"}</button>
			{/if}
			{#if canKill}
				<button
					class="rounded-md px-3 py-1 text-xs font-medium transition-colors {confirmingKill ? 'bg-[var(--ctp-red)] text-[var(--ctp-crust)]' : 'bg-[var(--ctp-surface0)] text-[var(--ctp-red)] hover:bg-[var(--ctp-red)] hover:text-[var(--ctp-crust)]'}"
					onclick={handleKill}
				>{confirmingKill ? "Confirm Kill" : "Kill"}</button>
			{/if}
		</div>
	</div>

	<!-- Changes view -->
	{#if mode === "changes"}
		<div class="flex-1 overflow-hidden">
			<DiffViewer agentId={agent.id} {agent} />
		</div>
	{:else}
		<!-- Issue detail -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if loading}
				<div class="skeleton mb-3 h-6 w-3/4"></div>
				<div class="skeleton mb-2 h-4 w-full"></div>
				<div class="skeleton mb-2 h-4 w-5/6"></div>
				<div class="skeleton mb-2 h-4 w-2/3"></div>
			{:else}
				<h2 class="mb-3 text-lg font-semibold text-[var(--ctp-text)]">{agent.issueTitle}</h2>
				{#if agent.issueBody}
					<div class="mb-4 border-b border-[var(--border)] pb-4 text-sm">
						<MarkdownRenderer content={agent.issueBody} />
					</div>
				{/if}
				{#if events.length > 0}
					<div>
						<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--ctp-subtext0)]">Timeline</h3>
						<EventTimeline {events} />
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

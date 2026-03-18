<script lang="ts">
import { fetchAgent } from "$lib/api";
import EventTimeline from "$lib/components/detail/EventTimeline.svelte";
import MarkdownRenderer from "$lib/components/detail/MarkdownRenderer.svelte";
import type { Agent, AgentEvent } from "$lib/types";

interface Props {
	agent: Agent;
}

let { agent }: Props = $props();

let events = $state<AgentEvent[]>([]);
let loading = $state(true);
let currentAgentId = $state<string | null>(null);
let pollInterval: ReturnType<typeof setInterval> | null = null;

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
	if (id !== currentAgentId) {
		currentAgentId = id;
		if (pollInterval) clearInterval(pollInterval);
		loadDetail(id, true);
		pollInterval = setInterval(() => loadDetail(id), 5000);
	}
	return () => {
		if (pollInterval) clearInterval(pollInterval);
	};
});

const labels = $derived(() => {
	// Try to parse labels from issueBody metadata or return empty
	// Labels come from the issue fetch at creation time
	return [] as string[];
});
</script>

<div class="flex h-full flex-col overflow-y-auto p-4">
	{#if loading}
		<div class="skeleton mb-3 h-6 w-3/4"></div>
		<div class="skeleton mb-2 h-4 w-full"></div>
		<div class="skeleton mb-2 h-4 w-5/6"></div>
		<div class="skeleton mb-2 h-4 w-2/3"></div>
	{:else}
		<!-- Title -->
		<h2 class="mb-3 text-lg font-semibold text-[var(--ctp-text)]">
			{agent.issueTitle}
		</h2>

		<!-- Labels -->
		{#if labels().length > 0}
			<div class="mb-3 flex flex-wrap gap-1.5">
				{#each labels() as label}
					<span
						class="rounded-full bg-[var(--ctp-surface0)] px-2 py-0.5 text-xs text-[var(--ctp-subtext1)]"
					>
						{label}
					</span>
				{/each}
			</div>
		{/if}

		<!-- Issue Body -->
		{#if agent.issueBody}
			<div class="mb-4 border-b border-[var(--border)] pb-4 text-sm">
				<MarkdownRenderer content={agent.issueBody} />
			</div>
		{/if}

		<!-- Event Timeline -->
		{#if events.length > 0}
			<div>
				<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--ctp-subtext0)]">
					Timeline
				</h3>
				<EventTimeline {events} />
			</div>
		{/if}
	{/if}
</div>

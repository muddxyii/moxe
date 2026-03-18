<script lang="ts">
import { fetchAgent } from "$lib/api";
import type { Agent, AgentEvent } from "$lib/types";

interface Props {
	agent: Agent;
}

let { agent }: Props = $props();

let events = $state<AgentEvent[]>([]);
let loading = $state(true);

async function loadDetail(id: string) {
	loading = true;
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
	loadDetail(agent.id);
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

		<!-- PR Link -->
		{#if agent.prUrl}
			<a
				href={agent.prUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="mb-3 flex items-center gap-2 rounded-md bg-[var(--ctp-green)]/10 px-3 py-2 text-sm text-[var(--ctp-green)] hover:bg-[var(--ctp-green)]/20"
			>
				<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"
					/>
				</svg>
				Pull Request #{agent.prNumber}
			</a>
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

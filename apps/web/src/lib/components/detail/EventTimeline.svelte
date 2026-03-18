<script lang="ts">
import type { AgentEvent } from "$lib/types";
import { formatEventType, timeAgo } from "$lib/utils";

interface Props {
	events: AgentEvent[];
}

let { events }: Props = $props();

const successEvents = new Set(["agent_done", "archive_done"]);
const failureEvents = new Set([
	"setup_failed",
	"agent_failed",
	"archive_failed",
	"killed",
]);

function dotColor(type: string): string {
	if (successEvents.has(type)) return "var(--ctp-green)";
	if (failureEvents.has(type)) return "var(--ctp-red)";
	return "var(--ctp-blue)";
}

function parseError(payload: string | null): string | null {
	if (!payload) return null;
	try {
		const parsed = JSON.parse(payload);
		const parts = [
			parsed.error,
			parsed.command ? `command: ${parsed.command}` : null,
		].filter(Boolean);
		return parts.join(" — ") || null;
	} catch {
		return null;
	}
}
</script>

<div class="flex flex-col">
	{#each events as event, i (event.id)}
		<div class="flex gap-3">
			<!-- Timeline line + dot -->
			<div class="flex flex-col items-center">
				<div
					class="h-3 w-3 shrink-0 rounded-full"
					style="background-color: {dotColor(event.type)};"
				></div>
				{#if i < events.length - 1}
					<div class="w-0.5 flex-1 bg-[var(--ctp-surface0)]"></div>
				{/if}
			</div>

			<!-- Content -->
			<div class="pb-4">
				<span class="text-sm font-medium text-[var(--ctp-text)]">
					{formatEventType(event.type)}
				</span>
				<span class="ml-2 text-xs text-[var(--ctp-subtext0)]">
					{timeAgo(event.ts)}
				</span>
				{#if failureEvents.has(event.type) && parseError(event.payload)}
					<p class="mt-1 rounded bg-[var(--ctp-surface0)] px-2 py-1 font-mono text-xs text-[var(--ctp-red)]">
						{parseError(event.payload)}
					</p>
				{/if}
			</div>
		</div>
	{/each}
</div>

<script lang="ts">
import { fetchDiff } from "$lib/api";
import type { Agent, DiffFile } from "$lib/types";

interface Props {
	agentId: string;
	agent: Agent;
}

let { agentId, agent }: Props = $props();

let files = $state<DiffFile[]>([]);
let selectedPath = $state<string | null>(null);
let loading = $state(true);

const selectedFile = $derived(
	files.find((f) => f.path === selectedPath) ?? null,
);

async function loadDiff(id: string) {
	loading = true;
	try {
		const result = await fetchDiff(id);
		files = result.files;
		if (files.length > 0 && !selectedPath) {
			selectedPath = files[0].path;
		}
	} catch {
		// toast shown by api client
	} finally {
		loading = false;
	}
}

$effect(() => {
	loadDiff(agentId);
});

function openInVsCode(path: string) {
	if (agent.worktreePath) {
		window.open(`vscode://file/${agent.worktreePath}/${path}`, "_blank");
	}
}

function parseDiffLines(
	diff: string,
): Array<{ type: "add" | "remove" | "context" | "header"; content: string }> {
	return diff.split("\n").map((line) => {
		if (line.startsWith("@@")) return { type: "header", content: line };
		if (line.startsWith("+")) return { type: "add", content: line };
		if (line.startsWith("-")) return { type: "remove", content: line };
		return { type: "context", content: line };
	});
}
</script>

<div class="flex h-full">
	<!-- File tree sidebar -->
	<div
		class="w-64 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--ctp-mantle)] py-2"
	>
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<span class="text-sm text-[var(--ctp-subtext0)]">Loading changes...</span>
			</div>
		{:else if files.length === 0}
			<div class="px-3 py-8 text-center text-sm text-[var(--ctp-subtext0)]">
				No changes found
			</div>
		{:else}
			<FileTree {files} {selectedPath} onSelect={(p) => (selectedPath = p)} />
		{/if}
	</div>

	<!-- Diff content -->
	<div class="flex-1 overflow-auto bg-[var(--background)]">
		{#if loading}
			<div class="flex h-full items-center justify-center">
				<span class="text-sm text-[var(--ctp-subtext0)]">Loading diff...</span>
			</div>
		{:else if selectedFile}
			<div class="border-b border-[var(--border)] bg-[var(--ctp-mantle)] px-4 py-2">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-[var(--ctp-text)]">
						{selectedFile.path}
					</span>
					<div class="flex items-center gap-2">
						<button
							class="rounded px-2 py-1 text-xs text-[var(--ctp-subtext0)] transition-colors hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
							onclick={() => openInVsCode(selectedFile.path)}
						>
							Open in VS Code
						</button>
					</div>
				</div>
			</div>

			<div class="font-mono text-sm">
				{#each parseDiffLines(selectedFile.diff) as line}
					{@const lineClass = line.type === "add" ? "bg-[var(--ctp-green)]/10 text-[var(--ctp-green)]" : line.type === "remove" ? "bg-[var(--ctp-red)]/10 text-[var(--ctp-red)]" : line.type === "header" ? "text-[var(--ctp-blue)]" : "text-[var(--ctp-subtext0)]"}
					<div class="px-4 py-0.5 {lineClass}">
						<pre class="whitespace-pre-wrap">{line.content}</pre>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex h-full items-center justify-center">
				<span class="text-sm text-[var(--ctp-subtext0)]">Select a file to view changes</span>
			</div>
		{/if}
	</div>
</div>

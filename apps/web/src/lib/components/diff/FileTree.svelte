<script lang="ts">
import type { DiffFile } from "$lib/types";

interface Props {
	files: DiffFile[];
	selectedPath: string | null;
	onSelect: (path: string) => void;
}

let { files, selectedPath, onSelect }: Props = $props();

const statusColors: Record<string, string> = {
	added: "var(--ctp-green)",
	modified: "var(--ctp-yellow)",
	deleted: "var(--ctp-red)",
	renamed: "var(--ctp-blue)",
};

const statusLabels: Record<string, string> = {
	added: "A",
	modified: "M",
	deleted: "D",
	renamed: "R",
};
</script>

<div class="flex flex-col gap-0.5">
	{#each files as file (file.path)}
		<button
			class="flex items-center gap-2 rounded px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--ctp-surface0)]"
			class:bg-[var(--ctp-surface1)]={file.path === selectedPath}
			onclick={() => onSelect(file.path)}
		>
			<span
				class="shrink-0 text-xs font-bold"
				style="color: {statusColors[file.status]};"
			>
				{statusLabels[file.status]}
			</span>
			<span class="truncate text-[var(--ctp-text)]">{file.path}</span>
		</button>
	{/each}
</div>

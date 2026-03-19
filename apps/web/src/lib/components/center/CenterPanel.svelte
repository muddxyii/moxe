<script lang="ts">
import { shellWsUrl, terminalWsUrl, worktreeShellWsUrl } from "$lib/api";
import EmptyState from "$lib/components/center/EmptyState.svelte";
import Terminal from "$lib/components/terminal/Terminal.svelte";
import { getSelectionStore } from "$lib/stores/selection.svelte";

const selectionStore = getSelectionStore();
const selection = $derived(selectionStore.selection);

const locationKey = $derived(
	selection ? selectionStore.locationKeyForSelection(selection) : null,
);

const currentTabs = $derived(
	locationKey ? (selectionStore.tabs[locationKey] ?? []) : [],
);

const activeId = $derived(
	locationKey ? (selectionStore.activeTabId[locationKey] ?? null) : null,
);

function handleAdd() {
	if (!locationKey || !selection) return;
	const tabId = crypto.randomUUID();
	let wsUrl: string;
	if (selection.type === "agent") {
		const existingTabs = selectionStore.tabs[locationKey] ?? [];
		// First tab = agent process (Claude), subsequent = plain shell in worktree
		wsUrl =
			existingTabs.length === 0
				? terminalWsUrl(selection.id)
				: worktreeShellWsUrl(selection.id, tabId);
	} else {
		wsUrl = shellWsUrl(selection.owner, selection.name, tabId);
	}
	selectionStore.openTab(locationKey, wsUrl, tabId);
}

function handleClose(tabId: string) {
	if (!locationKey) return;
	selectionStore.closeTab(locationKey, tabId);
}

function handleSwitch(tabId: string) {
	if (!locationKey) return;
	selectionStore.switchTab(locationKey, tabId);
}

function kindFromWsUrl(wsUrl: string): "shell" | "worktree-shell" | "agent" {
	if (wsUrl.includes("/ws/terminal/")) return "agent";
	if (wsUrl.includes("/ws/worktree-shell/")) return "worktree-shell";
	return "shell";
}

// Auto-open first tab when arriving at a location with no tabs
$effect(() => {
	if (!locationKey) return;
	// Try to restore from localStorage first
	if (currentTabs.length === 0) {
		selectionStore.restoreTabsForLocation(locationKey);
	}
	// Read tabs directly from reactive state (not the $derived currentTabs) —
	// $derived values don't update mid-effect after a synchronous mutation.
	if ((selectionStore.tabs[locationKey] ?? []).length === 0) {
		handleAdd();
	}
});
</script>

<div class="flex h-full flex-col border-r border-[var(--border)] bg-[var(--background)]">
	{#if !selection}
		<EmptyState />
	{:else if currentTabs.length === 0}
		<EmptyState />
	{:else}
		<!-- Tab bar -->
		<div class="flex h-12 items-stretch border-b border-[var(--border)] bg-[var(--ctp-mantle)] px-0">
			{#each currentTabs as tab (tab.id)}
				<button
					class="flex h-full min-w-[120px] items-center justify-between gap-2 border-r border-[var(--border)] px-3 text-sm transition-colors"
					class:bg-[var(--ctp-base)]={activeId === tab.id}
					class:text-[var(--ctp-text)]={activeId === tab.id}
					class:bg-[var(--ctp-crust)]={activeId !== tab.id}
					class:text-[var(--ctp-subtext0)]={activeId !== tab.id}
					onclick={() => handleSwitch(tab.id)}
				>
					<span class="min-w-0 flex-1 truncate">{tab.title}</span>
					<span
						class="shrink-0 opacity-50 hover:opacity-100"
						onclick={(e) => { e.stopPropagation(); handleClose(tab.id); }}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === "Enter" && handleClose(tab.id)}
					>×</span>
				</button>
			{/each}
			<div class="flex h-full items-center px-2">
				<button
					class="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--ctp-crust)] text-lg text-[var(--ctp-subtext0)] transition-colors hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
					onclick={handleAdd}
					title="New terminal"
				>
					<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
						<path d="M8 3.5v9M3.5 8h9" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Terminal area — all tabs mounted, inactive ones hidden via visibility -->
		<div class="relative flex-1 overflow-hidden bg-[var(--background)] p-2">
			{#each currentTabs as tab (tab.id)}
				<div
					class="absolute inset-2"
					style="visibility:{tab.id === activeId ? 'visible' : 'hidden'};"
				>
					<Terminal wsUrl={tab.wsUrl} kind={kindFromWsUrl(tab.wsUrl)} initialCommand={tab.initialCommand} onCommandSent={() => locationKey && selectionStore.clearInitialCommand(locationKey, tab.id)} />
				</div>
			{/each}
		</div>
	{/if}
</div>

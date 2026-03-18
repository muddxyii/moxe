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

<div class="flex h-full flex-col bg-[var(--background)]">
	{#if !selection}
		<EmptyState />
	{:else if currentTabs.length === 0}
		<EmptyState />
	{:else}
		<!-- Tab bar -->
		<div
			class="flex items-end border-b border-[var(--border)] bg-[var(--ctp-mantle)] px-2"
			style="padding-top:12px;padding-bottom:0;"
		>
			{#each currentTabs as tab (tab.id)}
				<button
					class="flex items-center gap-2 px-3 pb-3 text-xs border-b-2 transition-colors"
					class:border-[var(--ctp-blue)]={activeId === tab.id}
					class:text-[var(--ctp-text)]={activeId === tab.id}
					class:border-transparent={activeId !== tab.id}
					class:text-[var(--ctp-subtext0)]={activeId !== tab.id}
					onclick={() => handleSwitch(tab.id)}
					style="margin-bottom:-1px;"
				>
					{tab.title}
					<span
						class="ml-1 opacity-50 hover:opacity-100"
						onclick={(e) => { e.stopPropagation(); handleClose(tab.id); }}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === "Enter" && handleClose(tab.id)}
					>×</span>
				</button>
			{/each}
			<button
				class="px-3 pb-3 text-[var(--ctp-subtext0)] hover:text-[var(--ctp-text)] text-base transition-colors"
				onclick={handleAdd}
				title="New terminal"
			>+</button>
		</div>

		<!-- Terminal area — all tabs mounted, inactive ones hidden via visibility -->
		<div class="relative flex-1 overflow-hidden">
			{#each currentTabs as tab (tab.id)}
				<div
					class="absolute inset-0"
					style="visibility:{tab.id === activeId ? 'visible' : 'hidden'};"
				>
					<Terminal wsUrl={tab.wsUrl} kind={kindFromWsUrl(tab.wsUrl)} />
				</div>
			{/each}
		</div>
	{/if}
</div>

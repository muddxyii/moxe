<script lang="ts">
import { onMount } from "svelte";
import { toast } from "svelte-sonner";
import { addRepo, inspectRepo, pickRepoDirectory } from "$lib/api";
import RepoGroup from "$lib/components/sidebar/RepoGroup.svelte";
import { getAgentStore } from "$lib/stores/agents.svelte";
import { getSelectionStore } from "$lib/stores/selection.svelte";
import type { RepoInspection, WorkspaceGroup } from "$lib/types";

interface Props {
	onNewAgent: (workspace?: WorkspaceGroup) => void;
}

let { onNewAgent }: Props = $props();

const agentStore = getAgentStore();
const selectionStore = getSelectionStore();
let pendingWorkspace = $state<RepoInspection | null>(null);
let confirmingAdd = $state(false);
let pickingWorkspace = $state(false);

onMount(() => {
	agentStore.startPolling();
	return () => agentStore.stopPolling();
});

function handleKeydown(e: KeyboardEvent) {
	if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
		e.preventDefault();
		const index = Number.parseInt(e.key, 10) - 1;
		const allAgents = agentStore.agents;
		if (index < allAgents.length) {
			selectionStore.selectAgent(allAgents[index].id);
		}
	}
}

function isShellActive(owner: string, name: string): boolean {
	const sel = selectionStore.selection;
	return sel?.type === "shell" && sel.owner === owner && sel.name === name;
}

async function handleAddWorkspace() {
	pickingWorkspace = true;
	try {
		const { path } = await pickRepoDirectory();
		pendingWorkspace = await inspectRepo(path);
	} catch {
		// toast shown by api client
	} finally {
		pickingWorkspace = false;
	}
}

async function handleConfirmWorkspace() {
	if (!pendingWorkspace) return;
	confirmingAdd = true;
	try {
		const repo = await addRepo(pendingWorkspace.localPath);
		toast.success(`Added workspace ${repo.owner}/${repo.name}`);
		pendingWorkspace = null;
		agentStore.refreshAgents();
	} catch {
		// toast shown by api client
	} finally {
		confirmingAdd = false;
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full min-w-0 flex-col bg-[var(--ctp-crust)]">
	<div class="border-b border-[var(--ctp-surface1)] px-4 py-3">
		<button
			class="w-full rounded-lg bg-[var(--ctp-surface0)] px-3 py-2 text-left text-sm font-medium text-[var(--ctp-text)] transition-colors hover:bg-[var(--ctp-surface1)] disabled:opacity-60"
			onclick={handleAddWorkspace}
			disabled={pickingWorkspace}
		>
			{pickingWorkspace ? "Picking..." : "+ New Workspace"}
		</button>
	</div>

	<div class="flex-1 overflow-y-auto px-2 py-3">
		{#if agentStore.loading}
			{#each Array(3) as _}
				<div class="px-2 py-2">
					<div class="skeleton mb-2 h-4 w-3/4"></div>
					<div class="skeleton h-3 w-1/2"></div>
				</div>
			{/each}
		{:else if agentStore.workspaceGroups.length === 0}
			<div class="px-3 py-8 text-center text-sm text-[var(--ctp-subtext0)]">
				No workspaces yet. Click New Workspace to add one.
			</div>
		{:else}
			{#each agentStore.workspaceGroups as workspace (workspace.workspaceId)}
				<RepoGroup
					{workspace}
					showCompleted={agentStore.showCompleted}
					selectedAgentId={selectionStore.selectedAgentId}
					shellActive={isShellActive(workspace.owner, workspace.name)}
					onSelectAgent={(id: string) => selectionStore.selectAgent(id)}
					onSelectShell={() => selectionStore.selectShell(workspace.owner, workspace.name)}
					onNewAgent={onNewAgent}
				/>
			{/each}
		{/if}
	</div>

	<div class="border-t border-[var(--ctp-surface1)] px-3 py-2">
		<button
			class="flex w-full items-center gap-2 text-xs text-[var(--ctp-subtext0)] transition-colors hover:text-[var(--ctp-text)]"
			onclick={agentStore.toggleCompleted}
		>
			<span
				class="inline-flex h-4 w-4 items-center justify-center rounded border transition-colors {agentStore.showCompleted ? 'border-[var(--ctp-blue)] bg-[var(--ctp-blue)]' : 'border-[var(--ctp-overlay0)]'}"
			>
				{#if agentStore.showCompleted}
					<svg class="h-3 w-3 text-[var(--ctp-crust)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M2.5 6l2.5 2.5 4.5-5" />
					</svg>
				{/if}
			</span>
			Show completed
		</button>
	</div>
</div>

{#if pendingWorkspace}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onclick={(e) => {
			if (e.target === e.currentTarget && !confirmingAdd) pendingWorkspace = null;
		}}
	>
		<div class="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--ctp-mantle)] p-4 shadow-xl">
			<h3 class="text-sm font-semibold text-[var(--ctp-text)]">Confirm Workspace</h3>
			<p class="mt-2 text-sm text-[var(--ctp-subtext0)]">Is this the correct repository?</p>
			<div class="mt-3 space-y-1 rounded-md bg-[var(--ctp-surface0)] p-3">
				<div class="text-sm text-[var(--ctp-text)]">{pendingWorkspace.owner}/{pendingWorkspace.name}</div>
				<div class="break-all text-xs text-[var(--ctp-overlay0)]">{pendingWorkspace.localPath}</div>
			</div>
			{#if pendingWorkspace.alreadyRegistered}
				<p class="mt-2 text-xs text-[var(--ctp-yellow)]">This workspace is already registered.</p>
			{/if}
			<div class="mt-4 flex justify-end gap-2">
				<button
					class="rounded-md bg-[var(--ctp-surface0)] px-3 py-2 text-sm text-[var(--ctp-subtext1)] hover:bg-[var(--ctp-surface1)] disabled:opacity-60"
					onclick={() => (pendingWorkspace = null)}
					disabled={confirmingAdd}
				>
					Cancel
				</button>
				<button
					class="rounded-md bg-[var(--ctp-blue)] px-3 py-2 text-sm font-medium text-[var(--ctp-crust)] hover:opacity-80 disabled:opacity-60"
					onclick={handleConfirmWorkspace}
					disabled={confirmingAdd || pendingWorkspace.alreadyRegistered}
				>
					{confirmingAdd ? "Adding..." : "Add"}
				</button>
			</div>
		</div>
	</div>
{/if}

<script lang="ts">
import CenterPanel from "$lib/components/center/CenterPanel.svelte";
import IssueDetail from "$lib/components/detail/IssueDetail.svelte";
import WorkspaceConfig from "$lib/components/detail/WorkspaceConfig.svelte";
import ThreePanel from "$lib/components/layout/ThreePanel.svelte";
import NewAgentModal from "$lib/components/modals/NewAgentModal.svelte";
import SettingsModal from "$lib/components/modals/SettingsModal.svelte";
import AgentList from "$lib/components/sidebar/AgentList.svelte";
import { getSelectionStore } from "$lib/stores/selection.svelte";
import type { WorkspaceGroup } from "$lib/types";

let showNewAgent = $state(false);
let showSettings = $state(false);
let newAgentWorkspace = $state<WorkspaceGroup | null>(null);

const selectionStore = getSelectionStore();
const agent = $derived(selectionStore.selectedAgent);
const appVersion = import.meta.env.PUBLIC_MOXE_VERSION;
</script>

<ThreePanel>
	{#snippet left()}
		<div class="flex h-full flex-col border-r border-[var(--border)]">
			<div
				class="flex h-12 items-center justify-between border-b border-[var(--border)] bg-[var(--ctp-mantle)] px-2"
			>
				<span class="px-1 text-sm font-medium text-[var(--ctp-text)]">moxe v{appVersion}</span>
				<button
					class="rounded-md p-1 text-[var(--ctp-subtext0)] transition-colors hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
					onclick={() => (showSettings = true)}
					title="Settings"
				>
					<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
						<path d="M7.07 0c-.473 0-.88.33-.97.793L5.77 2.5a5.97 5.97 0 00-1.272.734L2.9 2.67a1.001 1.001 0 00-1.1.428L.73 4.9a1 1 0 00.13 1.22l1.272 1.1a6.07 6.07 0 000 1.56L.86 9.88a1 1 0 00-.13 1.22l1.07 1.8a1 1 0 001.1.428l1.597-.563c.39.29.816.54 1.272.734l.33 1.707c.09.463.497.793.97.793h2.14c.473 0 .88-.33.97-.793l.33-1.707a5.97 5.97 0 001.272-.734l1.597.563a1 1 0 001.1-.428l1.07-1.8a1 1 0 00-.13-1.22l-1.272-1.1a6.07 6.07 0 000-1.56l1.272-1.1a1 1 0 00.13-1.22l-1.07-1.8a1.001 1.001 0 00-1.1-.428l-1.597.563A5.97 5.97 0 009.49 2.5l-.33-1.707A1.001 1.001 0 008.19 0H7.07zM8 5.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z" />
					</svg>
				</button>
			</div>
			<div class="min-h-0 flex-1">
				<AgentList
					onNewAgent={(workspace) => { newAgentWorkspace = workspace ?? null; showNewAgent = true; }}
				/>
			</div>
		</div>
	{/snippet}

	{#snippet center()}
		<CenterPanel />
	{/snippet}

	{#snippet right()}
		{#if agent}
			<IssueDetail {agent} />
		{:else if selectionStore.selection?.type === "shell"}
			{@const sel = selectionStore.selection}
			<WorkspaceConfig owner={sel.owner} name={sel.name} />
		{:else}
			<div class="flex h-full flex-col">
				<div class="h-12 border-b border-[var(--border)] bg-[var(--ctp-mantle)]"></div>
				<div class="flex flex-1 items-center justify-center p-4 text-sm text-[var(--ctp-subtext0)]">
					Select a workspace or agent to get started
				</div>
			</div>
		{/if}
	{/snippet}
</ThreePanel>

{#if showNewAgent}
	<NewAgentModal preselectedOwner={newAgentWorkspace?.owner} preselectedName={newAgentWorkspace?.name} onClose={() => (showNewAgent = false)} />
{/if}

{#if showSettings}
	<SettingsModal onClose={() => (showSettings = false)} />
{/if}

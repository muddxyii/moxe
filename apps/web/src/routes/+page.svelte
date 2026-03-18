<script lang="ts">
import CenterPanel from "$lib/components/center/CenterPanel.svelte";
import IssueDetail from "$lib/components/detail/IssueDetail.svelte";
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
</script>

<ThreePanel>
	{#snippet left()}
		<AgentList
			onNewAgent={(workspace) => { newAgentWorkspace = workspace ?? null; showNewAgent = true; }}
			onSettings={() => (showSettings = true)}
		/>
	{/snippet}

	{#snippet center()}
		<CenterPanel />
	{/snippet}

	{#snippet right()}
		{#if agent}
			<IssueDetail {agent} />
		{:else if selectionStore.selection?.type === "shell"}
			{@const sel = selectionStore.selection}
			<div class="flex h-full flex-col p-4">
				<p class="text-sm font-semibold text-[var(--ctp-text)]">{sel.owner}/{sel.name}</p>
				<p class="mt-1 text-xs text-[var(--ctp-subtext0)]">Shell session</p>
			</div>
		{:else}
			<div class="flex h-full items-center justify-center p-4 text-sm text-[var(--ctp-subtext0)]">
				Select a workspace or agent to get started
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

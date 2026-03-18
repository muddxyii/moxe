<script lang="ts">
import { toast } from "svelte-sonner";
import { addRepo, createAgent, fetchIssues, fetchRepos } from "$lib/api";
import { getAgentStore } from "$lib/stores/agents.svelte";
import type { Issue, Repo } from "$lib/types";

interface Props {
	onClose: () => void;
}

let { onClose }: Props = $props();

const agentStore = getAgentStore();

let repos = $state<Repo[]>([]);
let selectedRepo = $state<Repo | null>(null);
let issues = $state<Issue[]>([]);
let selectedIssues = $state<Set<number>>(new Set());
let loadingRepos = $state(true);
let loadingIssues = $state(false);
let submitting = $state(false);

// Inline add-repo state
let showAddRepo = $state(false);
let newRepoPath = $state("");
let addingRepo = $state(false);

async function loadRepos() {
	loadingRepos = true;
	try {
		repos = await fetchRepos();
	} catch {
		// toast shown by api client
	} finally {
		loadingRepos = false;
	}
}

async function handleRepoSelect(repo: Repo) {
	selectedRepo = repo;
	selectedIssues = new Set();
	loadingIssues = true;
	try {
		issues = await fetchIssues(`${repo.owner}/${repo.name}`);
	} catch {
		// toast shown by api client
	} finally {
		loadingIssues = false;
	}
}

function toggleIssue(num: number) {
	const next = new Set(selectedIssues);
	if (next.has(num)) {
		next.delete(num);
	} else {
		next.add(num);
	}
	selectedIssues = next;
}

async function handleAddRepo() {
	if (!newRepoPath.trim()) return;
	addingRepo = true;
	try {
		const repo = await addRepo(newRepoPath.trim());
		repos = [...repos, repo];
		newRepoPath = "";
		showAddRepo = false;
		toast.success(`Added ${repo.owner}/${repo.name}`);
	} catch {
		// toast shown by api client
	} finally {
		addingRepo = false;
	}
}

async function handleSubmit() {
	if (!selectedRepo || selectedIssues.size === 0) return;
	submitting = true;
	const repo = `${selectedRepo.owner}/${selectedRepo.name}`;
	const repoPath = selectedRepo.localPath;

	try {
		for (const num of selectedIssues) {
			const issue = issues.find((i) => i.number === num);
			if (!issue) continue;
			await createAgent({
				repo,
				repoPath,
				issueNumber: issue.number,
				issueTitle: issue.title,
				issueBody: issue.body || null,
			});
		}
		toast.success(`Launched ${selectedIssues.size} agent(s)`);
		agentStore.refreshAgents();
		onClose();
	} catch {
		// toast shown by api client
	} finally {
		submitting = false;
	}
}

function handleBackdrop(e: MouseEvent) {
	if (e.target === e.currentTarget) onClose();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") onClose();
}

$effect(() => {
	loadRepos();
});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
	onclick={handleBackdrop}
>
	<div
		class="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--ctp-mantle)] shadow-xl"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
			<h2 class="text-sm font-semibold text-[var(--ctp-text)]">New Agent</h2>
			<button
				class="rounded p-1 text-[var(--ctp-subtext0)] hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
				onclick={onClose}
			>
				<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
					<path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
				</svg>
			</button>
		</div>

		<div class="flex-1 overflow-y-auto px-4 py-3">
			<!-- Step 1: Select Workspace -->
			<div class="mb-4">
				<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--ctp-subtext0)]">
					Workspace
				</label>

				{#if loadingRepos}
					<div class="skeleton h-9 w-full rounded-md"></div>
				{:else}
					<div class="space-y-1">
						{#each repos as repo}
							{@const isSelected = selectedRepo?.owner === repo.owner && selectedRepo?.name === repo.name}
							<button
								class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors {isSelected ? 'bg-[var(--ctp-surface1)] text-[var(--ctp-text)]' : 'bg-[var(--ctp-surface0)] text-[var(--ctp-subtext1)] hover:bg-[var(--ctp-surface1)]'}"
								onclick={() => handleRepoSelect(repo)}
							>
								<span>{repo.owner}/{repo.name}</span>
								<span class="text-xs text-[var(--ctp-overlay0)]">{repo.localPath}</span>
							</button>
						{/each}

						{#if !showAddRepo}
							<button
								class="w-full rounded-md border border-dashed border-[var(--ctp-surface1)] px-3 py-2 text-sm text-[var(--ctp-subtext0)] transition-colors hover:border-[var(--ctp-surface2)] hover:text-[var(--ctp-text)]"
								onclick={() => (showAddRepo = true)}
							>
								+ Add workspace
							</button>
						{:else}
							<div class="flex gap-2">
								<input
									type="text"
									bind:value={newRepoPath}
									placeholder="/path/to/local/clone"
									class="flex-1 rounded-md border border-[var(--border)] bg-[var(--ctp-base)] px-3 py-2 text-sm text-[var(--ctp-text)] placeholder:text-[var(--ctp-overlay0)] focus:border-[var(--ctp-blue)] focus:outline-none"
									onkeydown={(e) => { if (e.key === "Enter") handleAddRepo(); }}
								/>
								<button
									class="rounded-md bg-[var(--ctp-blue)] px-3 py-2 text-xs font-medium text-[var(--ctp-crust)] transition-opacity hover:opacity-80 disabled:opacity-50"
									onclick={handleAddRepo}
									disabled={addingRepo || !newRepoPath.trim()}
								>
									{addingRepo ? "..." : "Add"}
								</button>
								<button
									class="rounded-md bg-[var(--ctp-surface0)] px-3 py-2 text-xs text-[var(--ctp-subtext0)] hover:bg-[var(--ctp-surface1)]"
									onclick={() => { showAddRepo = false; newRepoPath = ""; }}
								>
									Cancel
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Step 2: Select Issues -->
			{#if selectedRepo}
				<div>
					<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--ctp-subtext0)]">
						Issues — {selectedRepo.owner}/{selectedRepo.name}
					</label>

					{#if loadingIssues}
						<div class="space-y-2">
							{#each Array(3) as _}
								<div class="skeleton h-10 w-full rounded-md"></div>
							{/each}
						</div>
					{:else if issues.length === 0}
						<div class="rounded-md bg-[var(--ctp-surface0)] px-3 py-4 text-center text-sm text-[var(--ctp-subtext0)]">
							No open issues found
						</div>
					{:else}
						<div class="max-h-60 space-y-1 overflow-y-auto">
							{#each issues as issue}
								{@const selected = selectedIssues.has(issue.number)}
								<button
									class="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors {selected ? 'bg-[var(--ctp-surface1)] text-[var(--ctp-text)]' : 'bg-[var(--ctp-surface0)] text-[var(--ctp-subtext1)] hover:bg-[var(--ctp-surface1)]'}"
									onclick={() => toggleIssue(issue.number)}
								>
									<span
										class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border {selected ? 'border-[var(--ctp-blue)] bg-[var(--ctp-blue)]' : 'border-[var(--ctp-surface2)]'}"
									>
										{#if selected}
											<svg class="h-3 w-3 text-[var(--ctp-crust)]" viewBox="0 0 16 16" fill="currentColor">
												<path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
											</svg>
										{/if}
									</span>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="text-xs text-[var(--ctp-overlay0)]">#{issue.number}</span>
											<span class="truncate">{issue.title}</span>
										</div>
										{#if issue.labels && issue.labels.length > 0}
											<div class="mt-1 flex flex-wrap gap-1">
												{#each issue.labels as label}
													<span class="rounded-full bg-[var(--ctp-surface1)] px-1.5 py-0.5 text-[10px] text-[var(--ctp-subtext0)]">
														{label}
													</span>
												{/each}
											</div>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
			<span class="text-xs text-[var(--ctp-subtext0)]">
				{#if selectedIssues.size > 0}
					{selectedIssues.size} issue{selectedIssues.size > 1 ? "s" : ""} selected
				{:else}
					Select issues to launch agents
				{/if}
			</span>
			<div class="flex gap-2">
				<button
					class="rounded-md bg-[var(--ctp-surface0)] px-4 py-2 text-sm text-[var(--ctp-subtext1)] transition-colors hover:bg-[var(--ctp-surface1)]"
					onclick={onClose}
				>
					Cancel
				</button>
				<button
					class="rounded-md bg-[var(--ctp-blue)] px-4 py-2 text-sm font-medium text-[var(--ctp-crust)] transition-opacity hover:opacity-80 disabled:opacity-50"
					disabled={selectedIssues.size === 0 || submitting}
					onclick={handleSubmit}
				>
					{submitting ? "Launching..." : "Launch"}
				</button>
			</div>
		</div>
	</div>
</div>

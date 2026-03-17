<script lang="ts">
import { toast } from "svelte-sonner";
import { deleteRepo, fetchRepos } from "$lib/api";
import type { Repo } from "$lib/types";

interface Props {
	onClose: () => void;
}

let { onClose }: Props = $props();

let repos = $state<Repo[]>([]);
let loading = $state(true);

async function loadRepos() {
	loading = true;
	try {
		repos = await fetchRepos();
	} catch {
		// toast shown by api client
	} finally {
		loading = false;
	}
}

async function handleRemove(repo: Repo) {
	try {
		await deleteRepo(repo.owner, repo.name);
		repos = repos.filter(
			(r) => !(r.owner === repo.owner && r.name === repo.name),
		);
		toast.success(`Removed ${repo.owner}/${repo.name}`);
	} catch {
		// toast shown by api client
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
		class="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--ctp-mantle)] shadow-xl"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
			<h2 class="text-sm font-semibold text-[var(--ctp-text)]">Settings</h2>
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
			<h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--ctp-subtext0)]">
				Registered Repositories
			</h3>

			{#if loading}
				<div class="space-y-2">
					{#each Array(2) as _}
						<div class="skeleton h-12 w-full rounded-md"></div>
					{/each}
				</div>
			{:else if repos.length === 0}
				<div class="rounded-md bg-[var(--ctp-surface0)] px-3 py-6 text-center text-sm text-[var(--ctp-subtext0)]">
					No repositories registered yet. Add one when creating an agent.
				</div>
			{:else}
				<div class="space-y-2">
					{#each repos as repo}
						<div
							class="flex items-center justify-between rounded-md bg-[var(--ctp-surface0)] px-3 py-2.5"
						>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium text-[var(--ctp-text)]">
									{repo.owner}/{repo.name}
								</div>
								<div class="truncate text-xs text-[var(--ctp-overlay0)]">
									{repo.localPath}
								</div>
							</div>
							<button
								class="ml-3 shrink-0 rounded p-1.5 text-[var(--ctp-subtext0)] transition-colors hover:bg-[var(--ctp-red)]/10 hover:text-[var(--ctp-red)]"
								onclick={() => handleRemove(repo)}
								title="Remove repository"
							>
								<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
									<path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex justify-end border-t border-[var(--border)] px-4 py-3">
			<button
				class="rounded-md bg-[var(--ctp-surface0)] px-4 py-2 text-sm text-[var(--ctp-subtext1)] transition-colors hover:bg-[var(--ctp-surface1)]"
				onclick={onClose}
			>
				Close
			</button>
		</div>
	</div>
</div>

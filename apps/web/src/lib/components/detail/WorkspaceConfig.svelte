<script lang="ts">
import { buildMoxeSetupPrompt } from "$lib/ai-setup";
import { fetchWorkspaceConfig, shellWsUrl } from "$lib/api";
import { getSelectionStore } from "$lib/stores/selection.svelte";
import type { WorkspaceConfig } from "$lib/types";

interface Props {
	owner: string;
	name: string;
}

let { owner, name }: Props = $props();

let config = $state<WorkspaceConfig | null>(null);
let loading = $state(true);
let showDropdown = $state(false);
let currentKey = $state("");

const selectionStore = getSelectionStore();

const allGood = $derived(
	config?.configured &&
		config.init.exists &&
		config.init.executable &&
		config.cleanup.exists &&
		config.cleanup.executable,
);

async function loadConfig() {
	loading = true;
	try {
		config = await fetchWorkspaceConfig(owner, name);
	} catch {
		config = null;
	} finally {
		loading = false;
	}
}

$effect(() => {
	const key = `${owner}/${name}`;
	if (key !== currentKey) {
		currentKey = key;
		loadConfig();
	}
});

function launchWithAgent(agent: "claude" | "codex" | "gemini") {
	showDropdown = false;
	const locationKey = `shell:${owner}/${name}`;
	const tabId = crypto.randomUUID();
	const wsUrl = shellWsUrl(owner, name, tabId);
	const prompt = buildMoxeSetupPrompt(owner, name);
	const command = buildAgentCommand(agent, prompt, tabId);
	selectionStore.openTab(locationKey, wsUrl, tabId, {
		title: agentLabel(agent),
		initialCommand: command,
	});
}

function agentLabel(agent: "claude" | "codex" | "gemini"): string {
	switch (agent) {
		case "claude":
			return "Claude";
		case "codex":
			return "Codex";
		case "gemini":
			return "Gemini";
	}
}

function buildAgentCommand(
	agent: "claude" | "codex" | "gemini",
	prompt: string,
	randomId: string,
): string {
	const delimiter = `MOXE_SETUP_${randomId.replaceAll("-", "")}`;
	switch (agent) {
		case "claude":
			return `claude "$(cat <<'${delimiter}'\n${prompt}\n${delimiter}\n)"`;
		case "codex":
			return `codex -- "$(cat <<'${delimiter}'\n${prompt}\n${delimiter}\n)"`;
		case "gemini":
			return `gemini "$(cat <<'${delimiter}'\n${prompt}\n${delimiter}\n)" --yolo`;
	}
}

function handleClickOutside(event: MouseEvent) {
	const target = event.target as HTMLElement;
	if (!target.closest("[data-dropdown]")) {
		showDropdown = false;
	}
}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="flex h-full flex-col overflow-hidden">
	<div
		class="flex h-12 items-center border-b border-[var(--border)] bg-[var(--ctp-mantle)] px-4"
	>
		<span class="text-sm font-medium text-[var(--ctp-text)]"
			>{owner}/{name}</span
		>
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		{#if loading}
			<div class="skeleton mb-3 h-5 w-2/3"></div>
			<div class="skeleton mb-2 h-4 w-full"></div>
			<div class="skeleton mb-2 h-4 w-5/6"></div>
		{:else if config}
			<h3
				class="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--ctp-subtext0)]"
			>
				Moxe Configuration
			</h3>

			<div class="space-y-2">
				<div class="flex items-center gap-2">
					{#if config.hasMoxeDir}
						<span class="text-[var(--ctp-green)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
						</span>
					{:else}
						<span class="text-[var(--ctp-red)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
						</span>
					{/if}
					<span class="text-sm text-[var(--ctp-text)]">.moxe/ directory</span>
				</div>

				<div class="flex items-center gap-2">
					{#if config.hasConfig}
						<span class="text-[var(--ctp-green)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
						</span>
					{:else}
						<span class="text-[var(--ctp-red)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
						</span>
					{/if}
					<span class="text-sm text-[var(--ctp-text)]">config.json</span>
				</div>

				<div class="flex items-center gap-2">
					{#if config.init.exists && config.init.executable}
						<span class="text-[var(--ctp-green)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
						</span>
					{:else if config.init.exists}
						<span class="text-[var(--ctp-yellow)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 11-2 0 1 1 0 012 0zM6.75 7.75a.75.75 0 000 1.5h.75v2.25a.75.75 0 001.5 0v-3a.75.75 0 00-.75-.75h-1.5z"/></svg>
						</span>
					{:else}
						<span class="text-[var(--ctp-red)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
						</span>
					{/if}
					<span class="text-sm text-[var(--ctp-text)]">init.sh</span>
					{#if config.init.exists && !config.init.executable}
						<span class="text-xs text-[var(--ctp-yellow)]">not executable</span>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					{#if config.cleanup.exists && config.cleanup.executable}
						<span class="text-[var(--ctp-green)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
						</span>
					{:else if config.cleanup.exists}
						<span class="text-[var(--ctp-yellow)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 11-2 0 1 1 0 012 0zM6.75 7.75a.75.75 0 000 1.5h.75v2.25a.75.75 0 001.5 0v-3a.75.75 0 00-.75-.75h-1.5z"/></svg>
						</span>
					{:else}
						<span class="text-[var(--ctp-red)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
						</span>
					{/if}
					<span class="text-sm text-[var(--ctp-text)]">cleanup.sh</span>
					{#if config.cleanup.exists && !config.cleanup.executable}
						<span class="text-xs text-[var(--ctp-yellow)]">not executable</span>
					{/if}
				</div>

				{#if config.baseBranch}
					<div class="flex items-center gap-2">
						<span class="text-[var(--ctp-green)]">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
						</span>
						<span class="text-sm text-[var(--ctp-text)]"
							>Base branch: <code
								class="rounded bg-[var(--ctp-surface0)] px-1.5 py-0.5 text-xs"
								>{config.baseBranch}</code
							></span
						>
					</div>
				{/if}
			</div>

			{#if !allGood}
				<div class="mt-6">
					<div class="relative" data-dropdown>
						<button
							class="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--ctp-blue)] px-4 py-2 text-sm font-medium text-[var(--ctp-crust)] transition-colors hover:bg-[var(--ctp-sapphire)]"
							onclick={() => (showDropdown = !showDropdown)}
						>
							<svg
								class="h-4 w-4"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									d="M8 2v4m0 0L6 4m2 2l2-2M3 7h10c.6 0 1 .4 1 1v5c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V8c0-.6.4-1 1-1z"
								/>
							</svg>
							Set up with AI
							<svg class="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
								<path d="M3 5l3 3 3-3" />
							</svg>
						</button>

						{#if showDropdown}
							<div
								class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--ctp-surface0)] shadow-lg"
							>
								<button
									class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--ctp-text)] transition-colors hover:bg-[var(--ctp-surface1)]"
									onclick={() => launchWithAgent("claude")}
								>
									<span
										class="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-[var(--ctp-peach)]"
										>C</span
									>
									<div>
										<div class="font-medium">Claude</div>
										<div class="text-xs text-[var(--ctp-subtext0)]">
											Anthropic's coding agent
										</div>
									</div>
								</button>
								<button
									class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--ctp-text)] transition-colors hover:bg-[var(--ctp-surface1)]"
									onclick={() => launchWithAgent("codex")}
								>
									<span
										class="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-[var(--ctp-green)]"
										>O</span
									>
									<div>
										<div class="font-medium">Codex</div>
										<div class="text-xs text-[var(--ctp-subtext0)]">
											OpenAI's coding agent
										</div>
									</div>
								</button>
								<button
									class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--ctp-text)] transition-colors hover:bg-[var(--ctp-surface1)]"
									onclick={() => launchWithAgent("gemini")}
								>
									<span
										class="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-[var(--ctp-blue)]"
										>G</span
									>
									<div>
										<div class="font-medium">Gemini</div>
										<div class="text-xs text-[var(--ctp-subtext0)]">
											Google's coding agent
										</div>
									</div>
								</button>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div
					class="mt-6 flex items-center gap-2 rounded-md bg-[var(--ctp-green)]/10 px-3 py-2 text-sm text-[var(--ctp-green)]"
				>
					<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"
						><path
							d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
						/></svg
					>
					Ready for agents
				</div>
			{/if}
		{:else}
			<p class="text-sm text-[var(--ctp-subtext0)]">
				Could not load configuration.
			</p>
		{/if}
	</div>
</div>

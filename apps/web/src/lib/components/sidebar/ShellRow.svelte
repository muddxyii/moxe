<script lang="ts">
interface Props {
	active: boolean;
	onclick: () => void;
}

let { active, onclick }: Props = $props();
</script>

<button
	class="relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors {active
		? 'bg-[var(--ctp-surface1)] text-[var(--ctp-text)]'
		: 'text-[var(--ctp-subtext1)] hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]'}"
	{onclick}
	title="shell"
>
	{#if active}
		<div class="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-[var(--ctp-green)]"></div>
	{/if}
	<svg aria-hidden="true" class="h-3.5 w-3.5 shrink-0 text-[var(--ctp-green)]" viewBox="0 0 16 16" fill="currentColor">
		<path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9zM4.5 6.5l2.5 2-2.5 2m4.5 0h2" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>
	<span class="font-mono text-xs">Shell</span>
</button>

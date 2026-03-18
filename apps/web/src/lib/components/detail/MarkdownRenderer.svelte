<script lang="ts">
import DOMPurify from "dompurify";
import { marked } from "marked";

interface Props {
	content: string;
}

let { content }: Props = $props();

const html = $derived(DOMPurify.sanitize(marked.parse(content) as string));
</script>

<div class="prose-catppuccin">
	{@html html}
</div>

<style>
	.prose-catppuccin :global(h1),
	.prose-catppuccin :global(h2),
	.prose-catppuccin :global(h3) {
		color: var(--ctp-text);
		margin-top: 1em;
		margin-bottom: 0.5em;
		font-weight: 600;
	}

	.prose-catppuccin :global(h1) {
		font-size: 1.25rem;
	}
	.prose-catppuccin :global(h2) {
		font-size: 1.1rem;
	}
	.prose-catppuccin :global(h3) {
		font-size: 1rem;
	}

	.prose-catppuccin :global(p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		line-height: 1.6;
	}

	.prose-catppuccin :global(a) {
		color: var(--ctp-blue);
		text-decoration: underline;
	}

	.prose-catppuccin :global(a:hover) {
		color: var(--ctp-sapphire);
	}

	.prose-catppuccin :global(code) {
		background: var(--ctp-surface0);
		padding: 0.15em 0.3em;
		border-radius: 4px;
		font-size: 0.85em;
		color: var(--ctp-peach);
	}

	.prose-catppuccin :global(pre) {
		background: var(--ctp-mantle);
		padding: 0.75em 1em;
		border-radius: 6px;
		overflow-x: auto;
		margin: 0.5em 0;
	}

	.prose-catppuccin :global(pre code) {
		background: transparent;
		padding: 0;
		color: var(--ctp-text);
	}

	.prose-catppuccin :global(ul),
	.prose-catppuccin :global(ol) {
		padding-left: 1.5em;
		margin: 0.5em 0;
	}

	.prose-catppuccin :global(li) {
		margin: 0.25em 0;
	}

	.prose-catppuccin :global(blockquote) {
		border-left: 3px solid var(--ctp-surface1);
		padding-left: 1em;
		margin: 0.5em 0;
		color: var(--ctp-subtext0);
	}

	.prose-catppuccin :global(img) {
		max-width: 100%;
		border-radius: 6px;
	}

	.prose-catppuccin :global(hr) {
		border: none;
		border-top: 1px solid var(--ctp-surface0);
		margin: 1em 0;
	}

	.prose-catppuccin :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.5em 0;
	}

	.prose-catppuccin :global(th),
	.prose-catppuccin :global(td) {
		border: 1px solid var(--ctp-surface0);
		padding: 0.4em 0.6em;
		text-align: left;
	}

	.prose-catppuccin :global(th) {
		background: var(--ctp-surface0);
		font-weight: 600;
	}
</style>

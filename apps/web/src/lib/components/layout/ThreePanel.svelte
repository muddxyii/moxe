<script lang="ts">
interface Props {
	left: import("svelte").Snippet;
	center: import("svelte").Snippet;
	right: import("svelte").Snippet;
}

let { left, center, right }: Props = $props();

let leftWidth = $state(240);
let rightWidth = $state(320);
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<ResizablePanel bind:width={leftWidth} minWidth={180} maxWidth={400} side="left">
		{@render left()}
	</ResizablePanel>

	<div class="min-w-[400px] flex-1 overflow-hidden">
		{@render center()}
	</div>

	<ResizablePanel bind:width={rightWidth} minWidth={240} maxWidth={500} side="right">
		{@render right()}
	</ResizablePanel>
</div>

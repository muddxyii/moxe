<script lang="ts">
interface Props {
	width: number;
	minWidth: number;
	maxWidth?: number;
	side: "left" | "right";
	children: import("svelte").Snippet;
}

let {
	width = $bindable(),
	minWidth,
	maxWidth = 600,
	side,
	children,
}: Props = $props();

let dragging = $state(false);
let startX = 0;
let startWidth = 0;

function onMouseDown(e: MouseEvent) {
	dragging = true;
	startX = e.clientX;
	startWidth = width;
	e.preventDefault();
}

function onMouseMove(e: MouseEvent) {
	if (!dragging) return;
	const delta = side === "left" ? e.clientX - startX : startX - e.clientX;
	const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
	width = newWidth;
}

function onMouseUp() {
	dragging = false;
}
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} />

<div class="relative flex shrink-0" style="width: {width}px;">
	<div class="h-full w-full overflow-hidden">
		{@render children()}
	</div>
	<div
		class="absolute top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-[var(--ctp-surface1)]"
		class:bg-[var(--ctp-surface1)]={dragging}
		style="{side === 'left' ? 'right' : 'left'}: -2px;"
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		onmousedown={onMouseDown}
	></div>
</div>

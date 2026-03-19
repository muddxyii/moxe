<script lang="ts">
import type { Terminal } from "@battlefieldduck/xterm-svelte";
import { Xterm, XtermAddon } from "@battlefieldduck/xterm-svelte";
import { onMount } from "svelte";
import { getSettingsStore } from "$lib/stores/settings.svelte";
import { getThemeById } from "$lib/theme/themes";

interface Props {
	wsUrl: string;
	kind: "shell" | "worktree-shell" | "agent";
}

let { wsUrl, kind }: Props = $props();

let terminal: Terminal | undefined = $state();
let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let connectionStatus = $state<"connecting" | "connected" | "disconnected">(
	"connecting",
);
let processAlive = $state(true);
let needsReset = false;
let suppressInput = false;
let writeBatch = "";
let batchRaf: number | null = null;
const settingsStore = getSettingsStore();
const terminalTheme = $derived(getThemeById(settingsStore.theme).terminal);

$effect(() => {
	if (!terminal) return;
	terminal.options.theme = terminalTheme;
});

async function onLoad(term: Terminal) {
	const { FitAddon } = await XtermAddon.FitAddon();
	const { WebLinksAddon } = await XtermAddon.WebLinksAddon();
	const fitAddon = new FitAddon();
	const webLinksAddon = new WebLinksAddon();
	term.loadAddon(fitAddon);
	term.loadAddon(webLinksAddon);
	try {
		const { WebglAddon } = await XtermAddon.WebglAddon();
		const webglAddon = new WebglAddon();
		webglAddon.onContextLoss(() => {
			webglAddon.dispose();
		});
		term.loadAddon(webglAddon);
	} catch {
		// WebGL not available — DOM renderer is fine
	}
	fitAddon.fit();
	term.focus();
	term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
		if (event.type !== "keydown" || event.key !== "Tab") return true;
		event.preventDefault();
		if (ws?.readyState !== WebSocket.OPEN || suppressInput) return false;
		ws.send(event.shiftKey ? "\u001b[Z" : "\t");
		return false;
	});

	const observer = new ResizeObserver(() => {
		fitAddon.fit();
		const dims = fitAddon.proposeDimensions();
		if (dims && ws?.readyState === WebSocket.OPEN) {
			ws.send(
				JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }),
			);
		}
	});
	const el = term.element;
	if (el) observer.observe(el);

	connectWs(wsUrl);
}

function onData(data: string) {
	if (suppressInput) return;
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(data);
	}
}

function queueWrite(data: string) {
	writeBatch += data;
	if (batchRaf === null) {
		batchRaf = requestAnimationFrame(() => {
			if (terminal && writeBatch) {
				terminal.write(writeBatch);
				writeBatch = "";
			}
			batchRaf = null;
		});
	}
}

function connectWs(url: string) {
	cleanupWs();
	connectionStatus = "connecting";
	processAlive = true; // optimistic reset — server will correct via status message
	ws = new WebSocket(url);

	ws.onopen = () => {
		connectionStatus = "connected";
		reconnectDelay = 1000;
		needsReset = true;
		// Ensure PTY dimensions match the rendered terminal immediately on connect.
		// Without this, server PTY may stay at default 120x40 until the next resize event.
		if (terminal) {
			ws?.send(
				JSON.stringify({
					type: "resize",
					cols: terminal.cols,
					rows: terminal.rows,
				}),
			);
		}
	};

	ws.onmessage = (event) => {
		if (!terminal || typeof event.data !== "string") return;
		try {
			const msg = JSON.parse(event.data);
			if (msg.type === "output") {
				if (needsReset) {
					// Suppress input during reset — terminal.reset() causes xterm to emit
					// device attribute queries (DA1) that would be typed into the shell as garbage
					suppressInput = true;
					terminal.reset();
					needsReset = false;
					terminal.write(msg.data);
					setTimeout(() => {
						suppressInput = false;
					}, 100);
				} else {
					queueWrite(msg.data);
				}
			} else if (msg.type === "status") {
				processAlive = msg.alive as boolean;
			}
		} catch {
			terminal.write(event.data);
		}
	};

	ws.onclose = () => {
		connectionStatus = "disconnected";
		scheduleReconnect(url);
	};

	ws.onerror = () => {
		ws?.close();
	};
}

function scheduleReconnect(url: string) {
	if (reconnectTimeout) clearTimeout(reconnectTimeout);
	reconnectTimeout = setTimeout(() => {
		connectWs(url);
		reconnectDelay = Math.min(reconnectDelay * 2, 10000);
	}, reconnectDelay);
}

function cleanupWs() {
	if (batchRaf !== null) {
		cancelAnimationFrame(batchRaf);
		batchRaf = null;
	}
	if (terminal && writeBatch) {
		terminal.write(writeBatch);
		writeBatch = "";
	}
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout);
		reconnectTimeout = null;
	}
	if (ws) {
		ws.onclose = null;
		ws.close();
		ws = null;
	}
}

function reconnectNow() {
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout);
		reconnectTimeout = null;
	}
	connectWs(wsUrl);
	reconnectDelay = 1000;
}

onMount(() => {
	settingsStore.initialize();
	return () => cleanupWs();
});
</script>

<div class="relative h-full w-full">
	<Xterm
		bind:terminal
		options={{
			theme: terminalTheme,
			scrollback: 10000,
			fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
			fontSize: 13,
			cursorBlink: true,
			convertEol: true,
		}}
		{onLoad}
		{onData}
		class="h-full w-full"
	/>

	{#if connectionStatus === "connecting"}
		<div class="absolute inset-0 flex items-center justify-center bg-[var(--ctp-base)]/80">
			<span class="text-sm text-[var(--ctp-subtext0)]">Connecting...</span>
		</div>
	{:else if connectionStatus === "disconnected"}
		<div class="absolute inset-0 flex items-center justify-center bg-[var(--ctp-base)]/80">
			<span class="text-sm text-[var(--ctp-peach)]">Disconnected — reconnecting...</span>
		</div>
	{:else if !processAlive}
		<div class="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-[var(--ctp-surface0)] border-t border-[var(--border)]">
			{#if kind === "agent"}
				<span class="text-sm text-[var(--ctp-subtext0)]">Agent process ended</span>
			{:else}
				<span class="text-sm text-[var(--ctp-subtext0)]">Shell exited</span>
				<button
					class="text-xs px-3 py-1 rounded bg-[var(--ctp-blue)] text-[var(--ctp-base)] hover:bg-[var(--ctp-sapphire)] transition-colors"
					onclick={reconnectNow}
				>
					Reconnect
				</button>
			{/if}
		</div>
	{/if}
</div>

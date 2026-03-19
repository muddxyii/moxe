import { getAgentStore } from "./agents.svelte";

type AgentSelection = { type: "agent"; id: string };
type ShellSelection = { type: "shell"; owner: string; name: string };
type Selection = AgentSelection | ShellSelection | null;

export type Tab = {
	id: string;
	title: string;
	wsUrl: string;
	initialCommand?: string;
};
export type LocationKey = string; // "agent:{id}" | "shell:{owner}/{name}"

let selection = $state<Selection>(null);
const tabs = $state<Record<LocationKey, Tab[]>>({});
const activeTabId = $state<Record<LocationKey, string>>({});

const selectedAgent = $derived(() => {
	if (selection?.type !== "agent") return null;
	const id = selection.id;
	const store = getAgentStore();
	return store.agents.find((a) => a.id === id) ?? null;
});

function locationKey(sel: NonNullable<Selection>): LocationKey {
	if (sel.type === "agent") return `agent:${sel.id}`;
	return `shell:${sel.owner}/${sel.name}`;
}

function loadTabsFromStorage(key: LocationKey): Tab[] {
	try {
		const raw = localStorage.getItem(`moxie:tabs:${key}`);
		return raw ? (JSON.parse(raw) as Tab[]) : [];
	} catch {
		return [];
	}
}

function loadActiveTabFromStorage(key: LocationKey): string | undefined {
	try {
		return localStorage.getItem(`moxie:activeTab:${key}`) ?? undefined;
	} catch {
		return undefined;
	}
}

function persistTabs(
	key: LocationKey,
	tabList: Tab[],
	activeId: string | undefined,
) {
	try {
		localStorage.setItem(`moxie:tabs:${key}`, JSON.stringify(tabList));
		if (activeId) {
			localStorage.setItem(`moxie:activeTab:${key}`, activeId);
		} else {
			localStorage.removeItem(`moxie:activeTab:${key}`);
		}
	} catch {
		// localStorage may be unavailable (SSR, private browsing quota)
	}
}

function clearTabsFromStorage(key: LocationKey) {
	try {
		localStorage.removeItem(`moxie:tabs:${key}`);
		localStorage.removeItem(`moxie:activeTab:${key}`);
	} catch {
		// ignore
	}
}

function nextTerminalNumber(tabList: Tab[]): number {
	const used = new Set<number>();
	for (const tab of tabList) {
		const match = /^Terminal (\d+)$/.exec(tab.title);
		if (!match) continue;
		const n = Number.parseInt(match[1], 10);
		if (Number.isInteger(n) && n > 0) used.add(n);
	}

	let candidate = 1;
	while (used.has(candidate)) candidate += 1;
	return candidate;
}

export function getSelectionStore() {
	return {
		get selection() {
			return selection;
		},
		get selectedAgentId() {
			return selection?.type === "agent" ? selection.id : null;
		},
		get selectedAgent() {
			return selectedAgent();
		},
		get tabs() {
			return tabs;
		},
		get activeTabId() {
			return activeTabId;
		},
		selectAgent(id: string) {
			selection = { type: "agent", id };
		},
		selectShell(owner: string, name: string) {
			selection = { type: "shell", owner, name };
		},
		clearSelection() {
			selection = null;
		},
		locationKeyForSelection(sel: NonNullable<Selection>): LocationKey {
			return locationKey(sel);
		},
		restoreTabsForLocation(key: LocationKey) {
			const stored = loadTabsFromStorage(key);
			if (stored.length > 0) {
				tabs[key] = stored;
				const activeId = loadActiveTabFromStorage(key);
				if (activeId && stored.some((t) => t.id === activeId)) {
					activeTabId[key] = activeId;
				} else {
					activeTabId[key] = stored[0].id;
				}
			}
		},
		openTab(
			key: LocationKey,
			wsUrl: string,
			id = crypto.randomUUID(),
			options?: { title?: string; initialCommand?: string },
		) {
			const existing = tabs[key] ?? [];
			const title =
				options?.title ?? `Terminal ${nextTerminalNumber(existing)}`;
			const tab: Tab = {
				id,
				title,
				wsUrl,
				initialCommand: options?.initialCommand,
			};
			tabs[key] = [...existing, tab];
			activeTabId[key] = tab.id;
			persistTabs(key, tabs[key], activeTabId[key]);
		},
		closeTab(key: LocationKey, tabId: string) {
			const existing = tabs[key] ?? [];
			const idx = existing.findIndex((t) => t.id === tabId);
			const next = existing.filter((t) => t.id !== tabId);
			tabs[key] = next;
			if (next.length === 0) {
				delete activeTabId[key];
				clearTabsFromStorage(key);
			} else {
				activeTabId[key] = next[Math.max(0, idx - 1)].id;
				persistTabs(key, tabs[key], activeTabId[key]);
			}
		},
		switchTab(key: LocationKey, tabId: string) {
			activeTabId[key] = tabId;
			persistTabs(key, tabs[key] ?? [], tabId);
		},
		clearInitialCommand(key: LocationKey, tabId: string) {
			const existing = tabs[key];
			if (!existing) return;
			const updated = existing.map((t) =>
				t.id === tabId ? { ...t, initialCommand: undefined } : t,
			);
			tabs[key] = updated;
			persistTabs(key, updated, activeTabId[key]);
		},
		clearLocation(key: LocationKey) {
			delete tabs[key];
			delete activeTabId[key];
			clearTabsFromStorage(key);
		},
	};
}

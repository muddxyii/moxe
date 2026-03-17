import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmdirSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { agents, db, eq } from "@moxe/db";

const MOXE_DIR = join(homedir(), ".moxe");
const ALLOCATIONS_PATH = join(MOXE_DIR, "port-allocations.json");
const LOCK_DIR = join(MOXE_DIR, ".port-lock");

interface Allocation {
	base: number;
	agentId: string;
	allocatedAt: string;
}

interface AllocationsFile {
	allocations: Record<string, Allocation>;
	nextBase: number;
}

export interface GlobalConfig {
	portRangeStart: number;
	portsPerWorkspace: number;
	scriptTimeout: number;
}

export function readGlobalConfig(): GlobalConfig {
	try {
		const raw = readFileSync(join(MOXE_DIR, "config.json"), "utf-8");
		const parsed = JSON.parse(raw) as Partial<GlobalConfig>;
		return {
			portRangeStart: parsed.portRangeStart ?? 4000,
			portsPerWorkspace: parsed.portsPerWorkspace ?? 10,
			scriptTimeout: parsed.scriptTimeout ?? 300_000,
		};
	} catch {
		return { portRangeStart: 4000, portsPerWorkspace: 10, scriptTimeout: 300_000 };
	}
}

function readAllocations(): AllocationsFile {
	try {
		return JSON.parse(readFileSync(ALLOCATIONS_PATH, "utf-8")) as AllocationsFile;
	} catch {
		const { portRangeStart } = readGlobalConfig();
		return { allocations: {}, nextBase: portRangeStart };
	}
}

function writeAllocations(data: AllocationsFile): void {
	mkdirSync(MOXE_DIR, { recursive: true });
	writeFileSync(ALLOCATIONS_PATH, JSON.stringify(data, null, 2));
}

export async function withPortLock<T>(fn: () => Promise<T>): Promise<T> {
	const deadline = Date.now() + 5000;
	while (true) {
		try {
			mkdirSync(LOCK_DIR);
			break;
		} catch {
			if (Date.now() >= deadline) {
				throw new Error("Port lock timeout after 5s");
			}
			await new Promise((r) => setTimeout(r, 100));
		}
	}
	try {
		return await fn();
	} finally {
		try {
			rmdirSync(LOCK_DIR);
		} catch {
			// Already gone — idempotent
		}
	}
}

export async function allocatePorts(
	workspaceName: string,
	agentId: string,
): Promise<number> {
	return withPortLock(async () => {
		const data = readAllocations();
		const { portsPerWorkspace } = readGlobalConfig();
		const base = data.nextBase;
		data.allocations[workspaceName] = {
			base,
			agentId,
			allocatedAt: new Date().toISOString(),
		};
		data.nextBase = base + portsPerWorkspace;
		writeAllocations(data);
		return base;
	});
}

export async function deallocatePorts(workspaceName: string): Promise<void> {
	await withPortLock(async () => {
		const data = readAllocations();
		delete data.allocations[workspaceName];
		writeAllocations(data);
	});
}

export async function reclaimStalePorts(): Promise<void> {
	await withPortLock(async () => {
		if (!existsSync(ALLOCATIONS_PATH)) return;
		const data = readAllocations();
		let changed = false;
		for (const [workspaceName, allocation] of Object.entries(data.allocations)) {
			const agent = db
				.select()
				.from(agents)
				.where(eq(agents.id, allocation.agentId))
				.get();
			if (!agent || agent.finishedAt !== null) {
				delete data.allocations[workspaceName];
				changed = true;
			}
		}
		if (changed) writeAllocations(data);
	});
}

import { toast } from "svelte-sonner";
import type { Agent, DiffFile, Issue, Repo } from "./types";

const BASE_URL = "http://localhost:3456";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		headers: { "Content-Type": "application/json" },
		...options,
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }));
		const message = body.error || res.statusText;
		toast.error(message);
		throw new Error(message);
	}
	return res.json();
}

export async function fetchAgents(): Promise<Agent[]> {
	return request("/api/agents");
}

export async function fetchAgent(
	id: string,
): Promise<Agent & { events: Agent["events"] }> {
	return request(`/api/agents/${id}`);
}

export async function createAgent(body: {
	repo: string;
	repoPath: string;
	issueNumber: number;
	issueTitle: string;
	issueBody: string | null;
}): Promise<Agent> {
	return request("/api/agents", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export async function killAgent(id: string): Promise<void> {
	await request(`/api/agents/${id}`, { method: "DELETE" });
}

export async function archiveAgent(id: string): Promise<void> {
	await request(`/api/agents/${id}/archive`, { method: "POST" });
}

export async function fetchIssues(repo: string): Promise<Issue[]> {
	return request(`/api/issues?repo=${encodeURIComponent(repo)}`);
}

export async function fetchDiff(id: string): Promise<{ files: DiffFile[] }> {
	return request(`/api/agents/${id}/diff`);
}

export async function fetchRepos(): Promise<Repo[]> {
	return request("/api/repos");
}

export async function pickRepoDirectory(): Promise<{ path: string }> {
	return request("/api/repos/pick", { method: "POST" });
}

export async function addRepo(localPath: string): Promise<Repo> {
	return request("/api/repos", {
		method: "POST",
		body: JSON.stringify({ localPath }),
	});
}

export async function deleteRepo(owner: string, name: string): Promise<void> {
	await request(
		`/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
		{
			method: "DELETE",
		},
	);
}

export function terminalWsUrl(agentId: string): string {
	return `ws://localhost:3456/ws/terminal/${agentId}`;
}

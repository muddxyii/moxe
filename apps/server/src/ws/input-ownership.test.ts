import { describe, expect, it } from "vitest";
import { claimInputOwnershipIfAlive } from "./input-ownership.js";

describe("claimInputOwnershipIfAlive", () => {
	it("claims ownership for the current websocket when session is alive", () => {
		const owners = new Map<string, object>();
		const firstWs = { id: "first" };
		const secondWs = { id: "second" };

		owners.set("agent-1", firstWs);

		const allowed = claimInputOwnershipIfAlive(
			owners,
			"agent-1",
			secondWs,
			true,
		);

		expect(allowed).toBe(true);
		expect(owners.get("agent-1")).toBe(secondWs);
	});

	it("does not claim ownership when session is not alive", () => {
		const owners = new Map<string, object>();
		const firstWs = { id: "first" };
		const secondWs = { id: "second" };

		owners.set("agent-1", firstWs);

		const allowed = claimInputOwnershipIfAlive(
			owners,
			"agent-1",
			secondWs,
			false,
		);

		expect(allowed).toBe(false);
		expect(owners.get("agent-1")).toBe(firstWs);
	});
});

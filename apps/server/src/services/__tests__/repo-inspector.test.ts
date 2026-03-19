import { describe, expect, it } from "vitest";
import {
	inspectRepoPath,
	parseGithubRepoFromRemote,
} from "../repo-inspector.js";

describe("parseGithubRepoFromRemote", () => {
	it("parses ssh github remotes", () => {
		expect(parseGithubRepoFromRemote("git@github.com:acme/moxie.git")).toEqual({
			owner: "acme",
			name: "moxie",
		});
	});

	it("parses https github remotes", () => {
		expect(
			parseGithubRepoFromRemote("https://github.com/acme/moxie.git"),
		).toEqual({
			owner: "acme",
			name: "moxie",
		});
	});

	it("returns null for unsupported remotes", () => {
		expect(
			parseGithubRepoFromRemote("https://gitlab.com/acme/moxie.git"),
		).toBeNull();
	});
});

describe("inspectRepoPath", () => {
	it("returns repo details and duplicate status", () => {
		const result = inspectRepoPath(
			"/tmp/moxie",
			[{ owner: "acme", name: "moxie", localPath: "/Users/me/moxie" }],
			() => true,
			() => "git@github.com:acme/moxie.git",
		);

		expect(result).toEqual({
			owner: "acme",
			name: "moxie",
			localPath: "/tmp/moxie",
			alreadyRegistered: true,
		});
	});

	it("throws when path does not exist", () => {
		expect(() =>
			inspectRepoPath(
				"/tmp/moxie",
				[],
				() => false,
				() => "",
			),
		).toThrow("Path does not exist");
	});

	it("throws when remote is not parseable", () => {
		expect(() =>
			inspectRepoPath(
				"/tmp/moxie",
				[],
				() => true,
				() => "file:///tmp/repo",
			),
		).toThrow("Could not parse GitHub remote from origin");
	});
});

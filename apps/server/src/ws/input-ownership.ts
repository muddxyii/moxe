export function claimInputOwnershipIfAlive<TWs>(
	owners: Map<string, TWs>,
	sessionKey: string,
	ws: TWs,
	alive: boolean,
): boolean {
	if (!alive) return false;
	owners.set(sessionKey, ws);
	return true;
}

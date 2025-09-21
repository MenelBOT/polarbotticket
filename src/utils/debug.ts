export function isDebugEnabled(section: string): boolean {
	const debugEnv = process.env.DEBUG;
	if (!debugEnv) return false;

	const patterns = debugEnv.split(",").map(p => p.trim());

	for (const pattern of patterns) {
		if (pattern === "*") return true;

		// Convert wildcard to regex: myapp:* => /^myapp:.*?$/
		const regex = new RegExp("^" + pattern.replace(/\*/g, ".*?") + "$");

		if (regex.test(section)) return true;
	}

	return false;
}

const cache = new Map<string, boolean>();

export function isDebugEnabledCached(section: string): boolean {
	if (cache.has(section)) return cache.get(section)!;
	const enabled = isDebugEnabled(section);
	cache.set(section, enabled);
	return enabled;
}
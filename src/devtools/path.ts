export function arrToPathString(arr: (string | number)[]): string {
	let out = "root"
	for (const p of arr) {
		if (typeof p === "number") out += `[${p}]`
		else out += (out === "root" ? "" : ".") + p
	}
	return out
}

export function pathStringToArr(path: string): (string | number)[] {
	if (!path || path === "root") return []

	let clean = path
	if (clean.startsWith("root")) {
		clean = clean.slice(4)
		if (clean.startsWith(".")) clean = clean.slice(1)
	}
	if (!clean) return []

	const parts: (string | number)[] = []

	clean.split(".").forEach((seg) => {
		const rx = /([^[\]]+)|\[(\d+)\]/g
		for (const m of seg.matchAll(rx)) {
			const [, key, idx] = m
			if (key !== undefined) parts.push(key)
			else if (idx !== undefined) parts.push(Number(idx))
		}
	})

	return parts
}

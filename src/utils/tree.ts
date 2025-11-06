export const isObjectLike = (v: unknown): v is Record<string, unknown> | unknown[] =>
	v !== null && typeof v === "object"

export function childPath(base: string, parentIsArray: boolean, childKey: string) {
	if (base === "root") return childKey
	return parentIsArray ? `${base}[${childKey}]` : `${base}.${childKey}`
}

export function collectAllPaths(
	value: unknown,
	base: string = "root",
	out: Set<string> = new Set<string>(),
	seen: WeakSet<object> = new WeakSet<object>(),
): Set<string> {
	out.add(base)

	if (!isObjectLike(value)) return out

	const obj = value as object
	if (seen.has(obj)) return out
	seen.add(obj)

	if (Array.isArray(value)) {
		value.forEach((item, i) => {
			const p = `${base}[${i}]`
			out.add(p)
			collectAllPaths(item, p, out, seen)
		})
	} else {
		Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
			const p = base === "root" ? k : `${base}.${k}`
			out.add(p)
			collectAllPaths(v, p, out, seen)
		})
	}
	return out
}

export function expandPathWithAncestors(
	setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>,
	path: string,
) {
	const parts = path.split(".")
	setExpanded((prev) => {
		const next = new Set(prev)
		for (let i = 0; i < parts.length; i++) {
			const p = parts.slice(0, i + 1).join(".")
			next.add(p)
		}
		return next
	})
}

export function toggleExpandFactory(
	expandedPaths: Set<string>,
	setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
	return (path: string) => {
		const next = new Set(expandedPaths)
		if (next.has(path)) next.delete(path)
		else next.add(path)
		setExpandedPaths(next)
	}
}

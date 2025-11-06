import JSON5 from "json5"

export function isNumericLiteral(s: string) {
	return /^[-+]?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?$/.test(s)
}

export function parseLooseValue(raw: string) {
	const trimmed = raw.trim()

	if (trimmed === "true") return true
	if (trimmed === "false") return false
	if (trimmed === "null") return null
	if (trimmed === "undefined") return undefined

	if (isNumericLiteral(trimmed)) return Number(trimmed)

	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			return JSON.parse(trimmed)
		} catch {
			try {
				return JSON5.parse(trimmed)
			} catch {
				// fall through
			}
		}
	}

	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		try {
			return trimmed.startsWith('"') ? JSON.parse(trimmed) : JSON5.parse(trimmed)
		} catch {
			return trimmed.slice(1, -1)
		}
	}

	return raw
}

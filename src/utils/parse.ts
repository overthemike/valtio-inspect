export function isNumericLiteral(s: string) {
	return /^[-+]?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?$/.test(s)
}

// We previously used the json5 package here, but the inspector needs to keep working
// even when optional dependencies are unavailable. The Function-based fallback
// accepts a superset of JSON (single quotes, trailing commas, comments) without
// pulling additional code into the build.
function evaluateJsonish(source: string) {
	return Function("\"use strict\";return (".concat(source, ");"))()
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
				return evaluateJsonish(trimmed)
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
			return trimmed.startsWith('"') ? JSON.parse(trimmed) : evaluateJsonish(trimmed)
		} catch {
			return trimmed.slice(1, -1)
		}
	}

	return raw
}

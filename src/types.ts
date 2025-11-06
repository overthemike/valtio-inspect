import type { EnhancedGlobalProxy, ProxyFactory } from "valtio-plugin"

export type Tab = "state" | "diff" | "subscribers"

export type Change = {
	id: number
	path: string
	from: unknown
	to: unknown
}

export type Snapshot = {
	id: number
	action: string
	timestamp: string
	changes: Change[]
}

export type Host = EnhancedGlobalProxy | ProxyFactory

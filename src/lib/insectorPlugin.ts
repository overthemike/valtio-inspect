/** biome-ignore-all lint/suspicious/noExplicitAny: <Need flexibility> */

import type { INTERNAL_Op } from "valtio"
import type { ValtioPlugin } from "valtio-plugin"

import { devtoolsBridge } from "../devtools/bridge"
import { arrToPathString, pathStringToArr } from "../devtools/path"
import type { Change, Snapshot } from "../types"

function nowStr() {
	const d = new Date()
	return d.toLocaleTimeString()
}

let changeId = 0

function setByPathInPlace(root: any, pathArr: (string | number)[], next: unknown) {
	if (pathArr.length === 0) {
		// replace root (best-effort shallow)
		if (root && typeof root === "object" && next && typeof next === "object") {
			// clear then assign
			for (const k of Object.keys(root)) delete (root as any)[k]
			Object.assign(root, next as object)
		}
		return
	}
	let cur = root
	for (let i = 0; i < pathArr.length - 1; i++) cur = cur[pathArr[i] as any]
	const last = pathArr[pathArr.length - 1] as any
	cur[last] = next
}

export function createDevtoolsPlugin(): ValtioPlugin {
	// plugin-local state
	let rootProxy: any = null
	let nextSnapId = 1
	let snapshots: Snapshot[] = [{ id: 0, action: "Initial State", timestamp: nowStr(), changes: [] }]

	// Accumulate the "current change" if transform/before/after provide pieces
	// but we’ll primarily rely on afterChange for "final" value.
	let pendingChange: null | {
		pathStr: string
		prev?: unknown
		next?: unknown
	} = null

	// expose edit API for the UI
	const installEditApi = () => {
		;(globalThis as any).__VALTIO_DEVTOOLS_EDIT__ = (path: string, next: unknown) => {
			if (!rootProxy) return
			const arr = pathStringToArr(path)
			setByPathInPlace(rootProxy, arr, next)
			// Optional: you could emit a synthetic snapshot here, but afterChange will run anyway.
		}
	}

	const pushSnapshot = (chg: Change) => {
		const snap: Snapshot = {
			id: nextSnapId++,
			action: chg.path,
			timestamp: nowStr(),
			changes: [chg],
		}
		snapshots = [...snapshots, snap].slice(-300) // keep last N
		devtoolsBridge.ingestSnaps(snapshots)
	}

	return {
		id: "devtools",

		onAttach() {
			// nothing special required; keep a handle if you need
			installEditApi()
		},

		onInit() {
			// Called when a proxy (global or instance) is created.
			// The plugin system sets metadata so we can detect rootProxy later in hooks.
			// We’ll push an initial state in afterChange on first mutation, but we can also try to get it here.
			// No root ref yet.
		},

		onSubscribe(_proxyObj: object, _cb: (ops: INTERNAL_Op[]) => void) {
			// optional: you can observe raw INTERNAL_Op stream here if desired.
		},

		onSnapshot(_snap: Record<string, unknown>) {
			// Called after snapshot() runs—good place to normalize if needed.
			// We don’t need to mutate it; the UI gets state via devtoolsBridge.ingestState from our hooks.
		},

		onGet(_path, _value, root) {
			// Cache the root so the edit API can mutate it.
			if (!rootProxy) rootProxy = root
			// no-op
		},

		transformSet(_path, _value, root) {
			// capture root for edit API
			if (!rootProxy) rootProxy = root
			// You could normalize value here; we’ll leave it as-is.
			return undefined // no transform
		},

		beforeChange(path, next, prev, root) {
			if (!rootProxy) rootProxy = root
			pendingChange = {
				pathStr: arrToPathString(path as (string | number)[]),
				prev,
				next,
			}
			// return false to cancel; we always allow
			return true
		},

		afterChange(path, next, root) {
			if (!rootProxy) rootProxy = root

			const pathStr = arrToPathString(path as (string | number)[])
			const from = pendingChange?.prev
			const to = next

			const change: Change = {
				id: changeId++,
				path: pathStr,
				from,
				to,
			}

			pushSnapshot(change)
			devtoolsBridge.ingestState(rootProxy)

			pendingChange = null
		},

		onDispose() {
			// clean up the edit hook
			if ((globalThis as any).__VALTIO_DEVTOOLS_EDIT__) {
				delete (globalThis as any).__VALTIO_DEVTOOLS_EDIT__
			}
		},
	}
}

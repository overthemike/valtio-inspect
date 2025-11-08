/** biome-ignore-all lint/suspicious/noExplicitAny: <Need flexibility> */

import { snapshot } from "valtio"
import type { INTERNAL_Op } from "valtio"
import type { ValtioPlugin } from "valtio-plugin"

import { devtoolsBridge } from "../devtools/bridge"
import { arrToPathString, pathStringToArr } from "../devtools/path"
import type { Change, Snapshot } from "../types"

function nowStr() {
	const d = new Date()
	return d.toLocaleTimeString()
}

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

function createInitialSnapshot(): Snapshot {
	return { id: 0, action: "Initial State", timestamp: nowStr(), changes: [] }
}

export function createDevtoolsPlugin(): ValtioPlugin {
	// plugin-local state
	let rootProxy: any = null
	let nextSnapId = 1
	let snapshots: Snapshot[] = [createInitialSnapshot()]
	let hasBroadcastInitial = false
	let uninstallGlobals: (() => void) | null = null
	let changeCounter = 0
	let snapshotWarningLogged = false

	// Accumulate the "current change" if transform/before/after provide pieces
	// but we’ll primarily rely on afterChange for "final" value.
	let pendingChange: null | {
		pathStr: string
		prev?: unknown
		next?: unknown
	} = null

	const broadcastState = () => {
		if (!rootProxy) return
		let plain = rootProxy
		try {
			plain = snapshot(rootProxy)
		} catch (err) {
			if (!snapshotWarningLogged) {
				snapshotWarningLogged = true
				console.warn("valtio-devtools: failed to snapshot state", err)
			}
		}
		devtoolsBridge.ingestState(plain)
	}

	const pushSnapshotsToUi = () => {
		devtoolsBridge.ingestSnaps(snapshots)
	}

	const resetSnapshots = () => {
		changeCounter = 0
		nextSnapId = 1
		snapshots = [createInitialSnapshot()]
		pushSnapshotsToUi()
		hasBroadcastInitial = rootProxy !== null
		if (rootProxy) broadcastState()
	}

	// expose edit & clear APIs for the UI
	const installGlobalApis = () => {
		uninstallGlobals?.()

		const previousEdit = (globalThis as any).__VALTIO_DEVTOOLS_EDIT__
		const previousClear = (globalThis as any).__VALTIO_DEVTOOLS_CLEAR__

		;(globalThis as any).__VALTIO_DEVTOOLS_EDIT__ = (path: string, next: unknown) => {
			if (!rootProxy) return
			const arr = pathStringToArr(path)
			setByPathInPlace(rootProxy, arr, next)
		}

		;(globalThis as any).__VALTIO_DEVTOOLS_CLEAR__ = () => {
			resetSnapshots()
		}

		uninstallGlobals = () => {
			if (previousEdit) (globalThis as any).__VALTIO_DEVTOOLS_EDIT__ = previousEdit
			else delete (globalThis as any).__VALTIO_DEVTOOLS_EDIT__

			if (previousClear) (globalThis as any).__VALTIO_DEVTOOLS_CLEAR__ = previousClear
			else delete (globalThis as any).__VALTIO_DEVTOOLS_CLEAR__
		}
	}

	const ensureRoot = (root: unknown) => {
		if (!rootProxy && root) rootProxy = root
		if (rootProxy && !hasBroadcastInitial) {
			hasBroadcastInitial = true
			broadcastState()
			pushSnapshotsToUi()
		}
	}

	const pushSnapshot = (chg: Change) => {
		const snap: Snapshot = {
			id: nextSnapId++,
			action: chg.path,
			timestamp: nowStr(),
			changes: [chg],
		}
		snapshots = [...snapshots, snap].slice(-300)
		pushSnapshotsToUi()
	}

	return {
		id: "devtools",

		onAttach() {
			installGlobalApis()
			pushSnapshotsToUi()
			if (rootProxy) broadcastState()
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
			ensureRoot(root)
			// no-op
		},

		transformSet(_path, _value, root) {
			// capture root for edit API
			ensureRoot(root)
			// You could normalize value here; we’ll leave it as-is.
			return undefined
		},

		beforeChange(path, next, prev, root) {
			ensureRoot(root)
			pendingChange = {
				pathStr: arrToPathString(path as (string | number)[]),
				prev,
				next,
			}
			return true
		},

		afterChange(path, next, root) {
			ensureRoot(root)

			const pathStr = arrToPathString(path as (string | number)[])
			const from = pendingChange?.prev
			const to = next

			const change: Change = {
				id: changeCounter++,
				path: pathStr,
				from,
				to,
			}

			pushSnapshot(change)
			broadcastState()
			pendingChange = null
		},

		onDispose() {
			uninstallGlobals?.()
			uninstallGlobals = null
		},
	}
}

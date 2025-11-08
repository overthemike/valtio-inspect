/** biome-ignore-all lint/suspicious/noExplicitAny: <Need flexibility> */
import React from "react"
import { snapshot } from "valtio"
import type { INTERNAL_Op } from "valtio"
import type { ValtioPlugin } from "valtio-plugin"

import { devtoolsBridge } from "../devtools/bridge"
import { arrToPathString, pathStringToArr } from "../devtools/path"
import type { Change, Snapshot, Subscriber } from "../types"

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

	// Subscriber tracking - tracks components by their snapshot context
	const subscribers = new Map<
		string,
		{
			id: string
			component: string
			paths: Set<string>
			renderCount: number
			lastRender: string
		}
	>()
	let nextSubscriberId = 0
	let currentSnapshotContext: string | null = null
	let currentSnapshotPaths = new Set<string>()

	// Accumulate the "current change" if transform/before/after provide pieces
	// but we'll primarily rely on afterChange for "final" value.
	let pendingChange: null | {
		pathStr: string
		prev?: unknown
		next?: unknown
	} = null

	const broadcastSubscribers = () => {
		const subscriberList: Subscriber[] = Array.from(subscribers.values()).map((sub) => ({
			id: sub.id,
			component: sub.component,
			paths: Array.from(sub.paths),
			renderCount: sub.renderCount,
			lastRender: sub.lastRender,
		}))
		devtoolsBridge.ingestSubscribers(subscriberList)
	}

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
			// We'll push an initial state in afterChange on first mutation, but we can also try to get it here.
			// No root ref yet.
		},

		onSubscribe(proxyObj: object, cb: (ops: INTERNAL_Op[]) => void) {
			ensureRoot(proxyObj)

			// Get component name from stack trace
			const error = new Error()
			const stack = error.stack || ""
			const stackLines = stack.split("\n")

			let componentName = "Unknown"
			for (const line of stackLines) {
				const match =
					line.match(/at\s+([A-Z][a-zA-Z0-9_]*)\s*\(/) || line.match(/([A-Z][a-zA-Z0-9_]*)@/)
				if (match?.[1]) {
					componentName = match[1]
					if (
						!["Object", "Function", "Array", "Promise", "Proxy"].includes(componentName) &&
						!componentName.startsWith("use")
					) {
						break
					}
				}
			}

			const subscriberId = `sub-${nextSubscriberId++}`
			const nowTimestamp =
				new Date().toLocaleTimeString("en-US", { hour12: false }) +
				"." +
				String(new Date().getMilliseconds()).padStart(3, "0")

			// Track this subscriber
			subscribers.set(subscriberId, {
				id: subscriberId,
				component: componentName,
				paths: new Set<string>(),
				renderCount: 0,
				lastRender: nowTimestamp,
			})

			// Wrap callback to track when it fires
			const originalCallback = cb
			const wrappedCallback = (ops: INTERNAL_Op[]) => {
				const sub = subscribers.get(subscriberId)
				if (sub) {
					sub.renderCount++
					sub.lastRender =
						new Date().toLocaleTimeString("en-US", { hour12: false }) +
						"." +
						String(new Date().getMilliseconds()).padStart(3, "0")
					broadcastSubscribers()
				}
				originalCallback(ops)
			}

			// Store the wrapped callback so we can track it
			;(cb as any).__subscriberId = subscriberId

			broadcastSubscribers()
		},

		onSnapshot(snap: Record<string, unknown>) {
			// When snapshot is called, we're likely in a component render
			// Extract component name from stack trace
			const error = new Error()
			const stack = error.stack || ""
			const stackLines = stack.split("\n")

			let componentName = "Unknown"
			for (const line of stackLines) {
				const match =
					line.match(/at\s+([A-Z][a-zA-Z0-9_]*)\s*\(/) || line.match(/([A-Z][a-zA-Z0-9_]*)@/)
				if (match?.[1]) {
					const name = match[1]
					// Look for React component names (PascalCase, not hooks or common objects)
					if (
						!["Object", "Function", "Array", "Promise", "Proxy", "Snapshot"].includes(name) &&
						!name.startsWith("use") &&
						/^[A-Z]/.test(name)
					) {
						componentName = name
						break
					}
				}
			}

			// Create or update subscriber for this component
			const subscriberId = `snapshot-${componentName}`
			let subscriber = subscribers.get(subscriberId)

			if (!subscriber) {
				subscriber = {
					id: subscriberId,
					component: componentName,
					paths: new Set<string>(),
					renderCount: 0,
					lastRender:
						new Date().toLocaleTimeString("en-US", { hour12: false }) +
						"." +
						String(new Date().getMilliseconds()).padStart(3, "0"),
				}
				subscribers.set(subscriberId, subscriber)
			}

			// Increment render count
			subscriber.renderCount++
			subscriber.lastRender =
				new Date().toLocaleTimeString("en-US", { hour12: false }) +
				"." +
				String(new Date().getMilliseconds()).padStart(3, "0")

			// Set up context for tracking gets during this snapshot
			currentSnapshotContext = subscriberId
			currentSnapshotPaths = new Set<string>()

			// Schedule finalization after snapshot completes
			Promise.resolve().then(() => {
				if (currentSnapshotContext === subscriberId) {
					// Merge paths collected during snapshot
					for (const p of currentSnapshotPaths) {
						subscriber!.paths.add(p)
					}
					broadcastSubscribers()
					currentSnapshotContext = null
					currentSnapshotPaths.clear()
				}
			})
		},

		onGet(path, _value, root) {
			ensureRoot(root)

			// If we're in a snapshot context, track this path access
			if (currentSnapshotContext) {
				const pathStr = arrToPathString(path as (string | number)[])
				currentSnapshotPaths.add(pathStr)
			}
		},

		transformSet(_path, _value, root) {
			// capture root for edit API
			ensureRoot(root)
			// You could normalize value here; we'll leave it as-is.
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

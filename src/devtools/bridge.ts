/** biome-ignore-all lint/suspicious/noExplicitAny: <flexibility> */
import type { Snapshot } from "../types"

type Listener<T> = (v: T) => void

function createEmitter<T>() {
	const listeners = new Set<Listener<T>>()

	return {
		emit(value: T) {
			for (const fn of listeners) fn(value)
		},
		on(fn: Listener<T>) {
			listeners.add(fn)
			return () => listeners.delete(fn)
		},
	}
}

export type DevtoolsHandle = {
onState: (fn: (s: unknown) => void) => () => void
onSnapshots: (fn: (s: Snapshot[]) => void) => () => void
ingestState: (s: unknown) => void
ingestSnaps: (snaps: Snapshot[]) => void
edit: (path: string, next: unknown) => void
clearSnapshots: () => void
getState: () => unknown | null
getSnapshots: () => Snapshot[]
}

export function createDevtoolsBridge(): DevtoolsHandle {
	const stateEmitter = createEmitter<unknown>()
	const snapsEmitter = createEmitter<Snapshot[]>()

	let state: unknown = null
	let snapshots: Snapshot[] = []

	function ingestState(next: unknown) {
		state = next
		stateEmitter.emit(state)
	}

	function ingestSnaps(next: Snapshot[]) {
		snapshots = next
		snapsEmitter.emit(snapshots)
	}

	function edit(path: string, next: unknown) {
		;(globalThis as any).__VALTIO_DEVTOOLS_EDIT__?.(path, next)
	}

	function clearSnapshots() {
		;(globalThis as any).__VALTIO_DEVTOOLS_CLEAR__?.()
	}

	function getState() {
		return state
	}

	function getSnapshots() {
		return snapshots
	}

	return {
		onState: stateEmitter.on,
		onSnapshots: snapsEmitter.on,
		ingestState,
		ingestSnaps,
edit,
clearSnapshots,
getState,
getSnapshots,
}
}

export const devtoolsBridge = createDevtoolsBridge()

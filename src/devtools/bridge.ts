/** biome-ignore-all lint/suspicious/noExplicitAny: <flexibility> */
import type { Snapshot, Subscriber } from "../types"

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
	onSubscribers: (fn: (s: Subscriber[]) => void) => () => void
	ingestState: (s: unknown) => void
	ingestSnaps: (snaps: Snapshot[]) => void
	ingestSubscribers: (subs: Subscriber[]) => void
	edit: (path: string, next: unknown) => void
	clearSnapshots: () => void
	getState: () => unknown | null
	getSnapshots: () => Snapshot[]
	getSubscribers: () => Subscriber[]
}

export function createDevtoolsBridge(): DevtoolsHandle {
	const stateEmitter = createEmitter<unknown>()
	const snapsEmitter = createEmitter<Snapshot[]>()
	const subscribersEmitter = createEmitter<Subscriber[]>()

	let state: unknown = null
	let snapshots: Snapshot[] = []
	let subscribers: Subscriber[] = []

	function ingestState(next: unknown) {
		state = next
		stateEmitter.emit(state)
	}

	function ingestSnaps(next: Snapshot[]) {
		snapshots = next
		snapsEmitter.emit(snapshots)
	}

	function ingestSubscribers(next: Subscriber[]) {
		subscribers = next
		subscribersEmitter.emit(subscribers)
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

	function getSubscribers() {
		return subscribers
	}

	return {
		onState: stateEmitter.on,
		onSnapshots: snapsEmitter.on,
		onSubscribers: subscribersEmitter.on,
		ingestState,
		ingestSnaps,
		ingestSubscribers,
		edit,
		clearSnapshots,
		getState,
		getSnapshots,
		getSubscribers,
	}
}

export const devtoolsBridge = createDevtoolsBridge()

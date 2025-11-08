import { proxy } from "valtio"
import "valtio-plugin"

import { createDevtoolsPlugin } from "../lib/insectorPlugin"

type Todo = { id: number; title: string; done: boolean }

type DemoState = {
	count: number
	user: { name: string; online: boolean }
	todos: Todo[]
}

const FLAG = "__VALTIO_DEVTOOLS_DEMO_INSTALLED__"

function runDemo(state: DemoState) {
	const steps: (() => void)[] = [
		() => {
			state.count += 1
		},
		() => {
			state.todos.push({ id: 3, title: "Toggle presence", done: false })
		},
		() => {
			state.user.online = true
		},
		() => {
			state.todos[0]!.done = true
		},
	]

	let idx = 0
	const tick = () => {
		if (idx >= steps.length) return
		steps[idx++]()
		setTimeout(tick, 600)
	}
	setTimeout(tick, 600)
}

const globalScope = globalThis as Record<string, unknown> & {
	__VALTIO_DEMO_STATE__?: DemoState
}

if (typeof window !== "undefined" && !(FLAG in globalScope)) {
	globalScope[FLAG] = true
	proxy.use(createDevtoolsPlugin())

	const demoState = proxy<DemoState>({
		count: 0,
		user: { name: "Ada", online: false },
		todos: [
			{ id: 1, title: "Wire devtools", done: false },
			{ id: 2, title: "Record snapshots", done: false },
		],
	})

	runDemo(demoState)

	if (import.meta.hot) {
		import.meta.hot.dispose(() => {
			delete globalScope[FLAG]
		})
	}

	globalScope.__VALTIO_DEMO_STATE__ = demoState
}

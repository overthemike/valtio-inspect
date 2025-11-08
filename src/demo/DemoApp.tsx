import { proxy, useSnapshot } from "valtio"
import { createDevtoolsPlugin } from "../lib/InpsectPlugin"
import "valtio-plugin"

type Todo = { id: number; title: string; done: boolean }

type DemoState = {
	count: number
	user: { name: string; online: boolean }
	todos: Todo[]
}

const FLAG = "__VALTIO_DEVTOOLS_DEMO_INSTALLED__"

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

	if (import.meta.hot) {
		import.meta.hot.dispose(() => {
			delete globalScope[FLAG]
		})
	}

	globalScope.__VALTIO_DEMO_STATE__ = demoState
}

// Demo Components that use the state
export function CounterDisplay() {
	const snap = useSnapshot(globalScope.__VALTIO_DEMO_STATE__!)
	return (
		<div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
			<h3 className="text-sm font-semibold text-orange-400 mb-2">Counter Display</h3>
			<div className="text-2xl font-bold text-gray-100">{snap.count}</div>
		</div>
	)
}

export function UserProfile() {
	const snap = useSnapshot(globalScope.__VALTIO_DEMO_STATE__!)
	return (
		<div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
			<h3 className="text-sm font-semibold text-orange-400 mb-2">User Profile</h3>
			<div className="text-gray-100">
				<div className="mb-1">
					Name: <span className="text-blue-300">{snap.user.name}</span>
				</div>
				<div className="flex items-center gap-2">
					Status:
					<span
						className={`px-2 py-0.5 rounded text-xs ${
							snap.user.online ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"
						}`}
					>
						{snap.user.online ? "Online" : "Offline"}
					</span>
				</div>
			</div>
		</div>
	)
}

export function TodoList() {
	const snap = useSnapshot(globalScope.__VALTIO_DEMO_STATE__!)
	return (
		<div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
			<h3 className="text-sm font-semibold text-orange-400 mb-2">Todo List</h3>
			<div className="space-y-2">
				{snap.todos.map((todo) => (
					<TodoItem key={todo.id} todo={todo} />
				))}
			</div>
		</div>
	)
}

function TodoItem({ todo }: { todo: Todo }) {
	return (
		<div className="flex items-center gap-2 text-gray-100 text-sm">
			<input
				type="checkbox"
				checked={todo.done}
				onChange={() => {
					const state = globalScope.__VALTIO_DEMO_STATE__!
					const item = state.todos.find((t) => t.id === todo.id)
					if (item) item.done = !item.done
				}}
				className="rounded"
			/>
			<span className={todo.done ? "line-through text-gray-500" : ""}>{todo.title}</span>
		</div>
	)
}

export function DemoControls() {
	return (
		<div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
			<h3 className="text-sm font-semibold text-orange-400 mb-3">Demo Controls</h3>
			<div className="space-y-2">
				<button
					type="button"
					onClick={() => {
						const state = globalScope.__VALTIO_DEMO_STATE__!
						state.count++
					}}
					className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
				>
					Increment Counter
				</button>
				<button
					type="button"
					onClick={() => {
						const state = globalScope.__VALTIO_DEMO_STATE__!
						state.user.online = !state.user.online
					}}
					className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
				>
					Toggle User Status
				</button>
				<button
					type="button"
					onClick={() => {
						const state = globalScope.__VALTIO_DEMO_STATE__!
						state.todos.push({
							id: Date.now(),
							title: `New Todo ${state.todos.length + 1}`,
							done: false,
						})
					}}
					className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors"
				>
					Add Todo
				</button>
				<button
					type="button"
					onClick={() => {
						const state = globalScope.__VALTIO_DEMO_STATE__!
						state.user.name = `User ${Math.floor(Math.random() * 100)}`
					}}
					className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm transition-colors"
				>
					Change Name
				</button>
			</div>
		</div>
	)
}

export function DemoApp() {
	return (
		<div className="min-h-screen bg-gray-950 text-gray-100 p-8">
			<div className="max-w-4xl mx-auto space-y-6">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-orange-500 mb-2">Valtio Devtools Demo</h1>
					<p className="text-gray-400 text-sm">
						Open the devtools panel to see subscriber tracking in action
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<CounterDisplay />
					<UserProfile />
					<TodoList />
					<DemoControls />
				</div>

				<div className="bg-gray-800 p-4 rounded-lg border border-gray-700 text-sm text-gray-400">
					<h4 className="font-semibold text-orange-400 mb-2">💡 Try this:</h4>
					<ul className="space-y-1 list-disc list-inside">
						<li>Click the buttons to trigger state changes</li>
						<li>Watch the "Subscribers" tab in the devtools panel</li>
						<li>Notice which components re-render for each state change</li>
						<li>See which paths each component accesses</li>
					</ul>
				</div>
			</div>
		</div>
	)
}

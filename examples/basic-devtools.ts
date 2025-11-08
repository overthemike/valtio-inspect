import { proxy } from "valtio"
import "valtio-plugin"

import { devtoolsBridge } from "../src/devtools/bridge"
import { createDevtoolsPlugin } from "../src/lib/insectorPlugin"

type Todo = { id: number; title: string; done: boolean }

type AppState = {
        count: number
        user: { name: string; online: boolean }
        todos: Todo[]
}

proxy.use(createDevtoolsPlugin())

const state = proxy<AppState>({
        count: 0,
        user: { name: "Ada", online: false },
        todos: [
                { id: 1, title: "Wire devtools", done: false },
                { id: 2, title: "Record snapshots", done: false },
        ],
})

const unsubscribeState = devtoolsBridge.onState((next) => {
        console.log("\nCurrent state from devtools bridge:\n", JSON.stringify(next, null, 2))
})

const unsubscribeSnapshots = devtoolsBridge.onSnapshots((snaps) => {
        console.log("Snapshots:", snaps.map((s) => `${s.id}:${s.action}`).join(", "))
})

function waitForFlush() {
        return new Promise((resolve) => setTimeout(resolve, 0))
}

state.count += 1
await waitForFlush()

state.todos.push({ id: 3, title: "Toggle presence", done: false })
await waitForFlush()

state.user.online = true
await waitForFlush()

// Simulate an edit coming from the inspector UI
;(globalThis as any).__VALTIO_DEVTOOLS_EDIT__?.("root.user.name", "Grace Hopper")
await waitForFlush()

// Demonstrate clearing snapshots via the bridge API
devtoolsBridge.clearSnapshots()
await waitForFlush()

unsubscribeState()
unsubscribeSnapshots()

console.log("\nExample complete. Open the inspector UI to see the same snapshots.")

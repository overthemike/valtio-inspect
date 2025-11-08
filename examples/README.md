# Valtio Inspect Examples

The snippets in this folder show how to wire the devtools plugin into small Valtio stores. They are plain TypeScript files so you can run them with any runtime that supports ES modules (e.g. `tsx`, `ts-node`, or the Vite Node runner).

## Running the examples

```bash
# install deps if you have not yet
pnpm install

# run with tsx
pnpm dlx tsx examples/basic-devtools.ts

# or run with ts-node
pnpm dlx ts-node --esm examples/basic-devtools.ts
```

Each script logs the state snapshots captured by the plugin so you can see what the inspector UI receives. The
`basic-devtools.ts` example also demonstrates calling `devtoolsBridge.clearSnapshots()` to wipe history from the
devtools plugin, mirroring the "Clear snapshots" button in the UI.

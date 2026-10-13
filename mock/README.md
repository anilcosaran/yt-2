# yt-2 mock layer

yt-2 is the Youtorch UI (components, styles, assets, i18n) with **no backend**. Everything that used to come from
the API Gateway comes from this folder.

| File | Job |
| --- | --- |
| `lib/gateway/client.ts` | Same exports as Youtorch, but every call goes to `mock/gateway.ts` instead of the network. |
| `mock/fixtures.ts` | Hand-written responses per endpoint (channels, avatars, inbox, tools history, storage URLs, …). **Edit/add here.** |
| `mock/data/tools-catalog.json` | The Tools catalog (13 tools, input fields, models), generated from the real node contracts. |
| `mock/generators/generate-tools-catalog.cjs` | Regenerates that JSON (reads the Youtorch repo read-only). |
| `mock/schema-mock.ts`, `generate.ts`, `repair.ts` | Anything without a fixture is generated from the zod schema the UI already declares. |
| `mock/vocabulary.ts` | Turkish sample titles/sentences/people and the image pool. |
| `mock/session.ts` | The signed-in demo account. Sign out sets the `yt2_mock_signed_out` cookie; login clears it. |
| `mock/network-shim.ts` | Blocks real network calls and stubs `EventSource` streams. |
| `lib/billing/mock-stripe.tsx` | Stand-in for Stripe Elements (no card data). |
| `lib/auth/firebase-client.ts` | Stand-in login driver: any login succeeds. |
| `components/library/library-store.ts` | The Library (smart collections, uploads, generations) keeps its own in-memory mock state; see `components/library/README.md`. |

## Add or change an endpoint

```ts
// mock/fixtures.ts
fixtures.push({
  method: 'GET',
  path: /^\/api\/v1\/some\/endpoint$/,
  merge: true, // only list fields you care about, the rest is generated
  handler: (request) => ({ data: { title: 'Hello' } }),
})
```

A fixture that does not match the schema is ignored with a console warning (`[yt-2 mock] …`).
Throw `mockError(404, 'NOT_FOUND', 'msg')` to preview an error state.

## Regenerate the Tools catalog

```bash
YOUTORCH_REPO=C:/Users/Anil/Desktop/Youtorch node mock/generators/generate-tools-catalog.cjs
```

## Run

```bash
npm install
npm run dev   # http://localhost:3100
```

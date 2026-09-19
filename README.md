# tryjev

Live at **https://www.tryjev.xyz/**

A playground for Jev, TypeSafe AI's fast decision model: preset scenarios on the left, an editable state plus typed questions in the middle, typed answers with probabilities on the right. Bring your own key and pick a provider: OpenRouter (`typesafe/jev-1.13`, `alpha.decisions`), Vercel AI Gateway (`typesafe-ai/jev`, AI SDK `experimental_evaluate`) or TypeSafe's own API (`jev-latest`, `POST /v1/systemone`).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173, pick a provider in the top bar and paste your key via the Key button. The key stays in your browser's localStorage and is forwarded per request in `x-provider` / `x-api-key` headers; the server never stores or logs it. For a private deployment where visitors should not paste keys, set `OPENROUTER_API_KEY` / `AI_GATEWAY_API_KEY` / `TYPESAFE_API_KEY` as server-side fallbacks (see `.env.example`). The top bar also switches between the BlockFrame (candy) and Swiss themes; `?theme=swiss` works too.

## Layout

- `src/routes/api/evaluate/+server.ts` - reads provider + key from headers and hands off to `src/lib/server/providers.ts`
- `src/lib/server/providers.ts` - one adapter per provider; same `{ state, questions }` in, responses normalized to noul / choice / score with confidence and usage (Vercel calls noul "boolean" and keeps confidence in providerMetadata; both are mapped back)
- `src/lib/scenarios.ts` - five preset scenarios (one sentence one probability, ticket triage, model routing, content moderation, guarding LLM output), each with alternate states one click away
- `src/lib/types.ts` - shared request/response types, provider and model id tables
- `src/routes/+page.svelte` - the UI (Svelte 5)
- `src/app.css` / `src/theme-candy.css` - Swiss minimal base + BlockFrame candy theme

## Three question types

| type | asks | returns |
|---|---|---|
| `noul` | is this statement true (optional `criteria: { true, false }`, both or neither) | `noul`: probability from 0 to 1 |
| `choice` | pick one of the `criteria` keys | `choice` + `probabilities` + `confidence` |
| `score` | rate on the ordered `criteria` levels | `score` (interpolated) + `probabilities` + `confidence` |

The key travels one way only: browser localStorage → request header → this server → the provider you chose.

# tryjev

Live at **https://www.tryjev.xyz/**

A playground for Jev, TypeSafe AI's fast decision model: preset scenarios on the left, an editable state plus typed questions in the middle, typed answers with probabilities on the right. Bring your own key and pick a provider: OpenRouter (`typesafe/jev-1.13`, `alpha.decisions`), Vercel AI Gateway (`typesafe-ai/jev`, AI SDK `experimental_evaluate`) or TypeSafe's own API (`jev-latest`, `POST /v1/systemone`).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173, pick a provider in the top bar and paste your key via the Key button. The key stays in your browser's localStorage and is forwarded per request in `x-provider` / `x-api-key` headers; the server never stores or logs it. For a private deployment where visitors should not paste keys, set `OPENROUTER_API_KEY` / `AI_GATEWAY_API_KEY` / `TYPESAFE_API_KEY` as server-side fallbacks (see `.env.example`). The top bar also switches between the BlockFrame (candy) and Swiss themes; `?theme=swiss` works too.

## Three question types

| type | asks | returns |
|---|---|---|
| `noul` | is this statement true (optional `criteria: { true, false }`, both or neither) | `noul`: probability from 0 to 1 |
| `choice` | pick one of the `criteria` keys | `choice` + `probabilities` + `confidence` |
| `score` | rate on the ordered `criteria` levels | `score` (interpolated) + `probabilities` + `confidence` |

The key travels one way only: browser localStorage → request header → this server → the provider you chose.

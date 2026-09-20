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
- `src/routes/+page.svelte` - the playground UI (Svelte 5)
- `src/routes/jev/+page.svelte` - "About Jev": what a System One model is, the three question types, recommended patterns, pricing (vendor claims), one call example per provider (`/about` redirects here)
- `src/routes/cookbook/+page.svelte` + `src/lib/cookbook.ts` - eleven copy-paste recipes (JSON body, curl, "then in code"); `/?recipe=<id>` and `/?scenario=<id>` preload the playground
- `src/lib/SiteNav.svelte` / `src/lib/PageHeader.svelte` - top-bar nav shared by every page, header for the content pages
- `src/lib/Seo.svelte` - per-route title / description / canonical / Open Graph / Twitter / JSON-LD; site-wide tags stay in `src/routes/+layout.svelte`
- `src/lib/site.ts` - `SITE_URL` and the `PAGES` list that feeds `sitemap.xml` (bump `lastmod` when a page changes)
- `src/lib/theme.svelte.ts` - shared theme state; `src/app.html` sets `data-theme` before first paint
- `src/app.css` / `src/theme-candy.css` - Swiss minimal base + BlockFrame candy theme
- `seo/` - HTML sources for the icons and the OG images; render with `PLAYWRIGHT=<path to an installed playwright/index.mjs> node seo/render.mjs [og] [og-jev] [og-cookbook] [icons]`

## Three question types

| type | asks | returns |
|---|---|---|
| `noul` | is this statement true (optional `criteria: { true, false }`, both or neither) | `noul`: probability from 0 to 1 |
| `choice` | pick one of the `criteria` keys | `choice` + `probabilities` + `confidence` |
| `score` | rate on the ordered `criteria` levels | `score` (interpolated) + `probabilities` + `confidence` |

The key travels one way only: browser localStorage → request header → this server → the provider you chose.

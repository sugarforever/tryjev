<script lang="ts">
	import Seo from '$lib/Seo.svelte';
	import ThemeSwitch from '$lib/ThemeSwitch.svelte';
	import { MODEL_IDS, PRICE_PER_MTOK_INPUT } from '$lib/types';
	import { SITE_URL, REPO_URL } from '$lib/site';

	const DOCS = 'https://docs.typesafe.ai';
	const BLOG = 'https://typesafe.ai/blog/introducing-system-one-models-and-jev';
	const PUBLISHED = '2026-09-20';

	const title = 'What is Jev? TypeSafe AI’s System One decision model, explained';
	const description =
		'Jev does not generate text. It evaluates a state against typed questions (choice, score, noul) in parallel and returns calibrated probabilities. How System One models work, the three question types, the patterns TypeSafe recommends, pricing, and how to call Jev via OpenRouter, Vercel AI Gateway or TypeSafe’s API.';

	const jsonLd = [
		{
			'@type': 'TechArticle',
			headline: title,
			description,
			url: `${SITE_URL}/jev`,
			mainEntityOfPage: `${SITE_URL}/jev`,
			image: `${SITE_URL}/og-jev.png`,
			datePublished: PUBLISHED,
			dateModified: PUBLISHED,
			inLanguage: 'en',
			author: { '@type': 'Person', name: 'VerySmallWoods', url: 'https://x.com/verysmallwoods' },
			publisher: { '@type': 'Organization', name: 'tryjev', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
			about: { '@type': 'SoftwareApplication', name: 'Jev', applicationCategory: 'DeveloperApplication', creator: { '@type': 'Organization', name: 'TypeSafe AI', url: 'https://typesafe.ai' } },
			proficiencyLevel: 'Beginner',
			keywords: 'Jev, System One model, TypeSafe AI, decision model, choice, score, noul, calibrated probabilities, OpenRouter, Vercel AI Gateway'
		},
		{
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Jev Playground', item: `${SITE_URL}/` },
				{ '@type': 'ListItem', position: 2, name: 'About Jev', item: `${SITE_URL}/jev` }
			]
		}
	];

	// Shared request used by every provider example below (first playground scenario plus one choice)
	const request = `{
  "state": "Support issued a full refund of $42.50 to the customer and closed the ticket.",
  "questions": {
    "refunded": { "type": "noul", "instructions": "Has the refund been completed?" },
    "category": {
      "type": "choice",
      "instructions": "Main category of this ticket",
      "criteria": { "billing": "Charges, payments or refunds", "bug": "Product failure", "other": null }
    },
    "urgency": {
      "type": "score",
      "instructions": "How urgent is this for the customer",
      "criteria": ["low: can wait", "medium: this week", "high: right now"]
    }
  }
}`;

	// The three adapters, trimmed from src/lib/server/providers.ts
	const exOpenRouter = `import { OpenRouter } from '@openrouter/sdk';

const client = new OpenRouter({ apiKey });
const d = await client.alpha.decisions.create({
  decisionsRequest: { model: '${MODEL_IDS.openrouter}', state, questions }
});
// d.answers · d.usage.inputTokens · d.model · d.id · d.provider`;

	const exTypeSafe = `const res = await fetch('https://api.typesafe.ai/v1/systemone', {
  method: 'POST',
  headers: { authorization: \`Bearer \${apiKey}\`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: '${MODEL_IDS.typesafe}', state, questions })
});
const d = await res.json();
// d.answers · d.usage.input_tokens (snake_case here) · d.model`;

	const exVercel = `import { experimental_evaluate as evaluate } from 'ai';
import { createGateway } from '@ai-sdk/gateway';

const gateway = createGateway({ apiKey });
const r = await evaluate({
  model: gateway.evaluationModel('${MODEL_IDS.vercel}'),
  state,
  questions // noul is spelled { type: 'boolean', ... } in the AI SDK
});
// r.answers.refunded → { type: 'boolean', probability: 0.97 }
// r.providerMetadata.typesafe.confidence → { category: 0.91, urgency: 0.62 }
// r.usage.inputTokens · r.response.modelId`;

	const answers = `{
  "answers": {
    "refunded": { "type": "noul", "noul": 0.97 },
    "category": {
      "type": "choice", "choice": "billing",
      "probabilities": { "billing": 0.94, "bug": 0.02, "other": 0.04 },
      "confidence": 0.91
    },
    "urgency": {
      "type": "score", "score": 0.31,
      "probabilities": { "0": 0.72, "1": 0.25, "2": 0.03 },
      "legend": { "0": "low: can wait", "1": "medium: this week", "2": "high: right now" },
      "confidence": 0.62
    }
  },
  "usage": { "inputTokens": 118, "outputTokens": 0 },
  "model": "${MODEL_IDS.openrouter}"
}`;
</script>

<Seo
	{title}
	{description}
	path="/jev"
	type="article"
	image="/og-jev.png"
	imageAlt="JEV · What is a System One model? No text, just probabilities: choice, score, noul"
	keywords="what is Jev, System One model, TypeSafe AI, decision model, choice score noul, calibrated probabilities, speculative fan-out, confidence-gated routing, OpenRouter typesafe/jev-1.13, Vercel AI Gateway typesafe-ai/jev, api.typesafe.ai systemone"
	{jsonLd}
/>

<div class="page">
	<header class="topbar">
		<div class="title">
			<div>
				<a href="/" class="h3" aria-label="Jev Playground home">tryjev</a>
				<p class="sub">About Jev · a System One decision model</p>
			</div>
		</div>
		<div class="meta">
			<nav class="nav" aria-label="Site">
				<a href="/">Playground</a>
				<a href="/jev" aria-current="page">About Jev</a>
			</nav>
			<ThemeSwitch />
		</div>
	</header>

	<article class="article">
		<section class="hero">
			<span class="kicker">What is Jev?</span>
			<h1>A model that answers, but never writes</h1>
			<p class="lede">
				Jev is TypeSafe AI’s <strong>System One model</strong>: you give it a state and a set of typed questions, and it returns typed
				answers with calibrated probabilities. No prompt engineering for output formats, no parsing, no hallucinated prose, because
				there is no prose. This page explains the idea, the three question types, the patterns TypeSafe recommends, what it costs,
				and the three ways to call it. Then go and poke it in the playground.
			</p>
			<div class="actions">
				<a class="btn primary" href="/">Open the playground</a>
				<a class="btn" href={DOCS} target="_blank" rel="noreferrer">TypeSafe docs</a>
				<a class="btn" href={BLOG} target="_blank" rel="noreferrer">Announcement post</a>
			</div>
		</section>

		<section id="system-one">
			<h2>System 1, not System 2</h2>
			<p>
				The name borrows Daniel Kahneman’s split between <strong>System 1</strong> (fast, intuitive, automatic: “is this email spam?”,
				“is this customer angry?”) and <strong>System 2</strong> (slow, deliberate, step-by-step). A large language model is a System 2
				machine: it reasons token by token and hands you a paragraph that your code then has to parse and trust.
			</p>
			<p>
				A System One model gives up text generation entirely. The input is a <strong>state</strong> (a string, a JSON object or an
				array, such as a chat transcript) plus a map of <strong>typed questions</strong>. Every question is evaluated against the
				state <strong>in parallel, in one call</strong>, and the output is a typed value per question together with a probability
				distribution over the answer space you defined. Because the answer space is fixed up front, the model cannot invent an
				option, and because every answer comes with a probability, your code can branch on “how sure”, not just “what”.
			</p>
			<p>
				TypeSafe pitches Jev as the first model of this class and describes it as calibrated: higher reported confidence should mean
				higher accuracy, and similar inputs should get similar answers. That is a vendor claim; the playground shows you the numbers
				per call so you can judge on your own data.
			</p>
		</section>

		<section id="question-types">
			<h2>Three question types</h2>
			<p>
				Every question has an <code>instructions</code> string and a <code>type</code>. The type decides what the criteria look like and
				what comes back. Question ids are yours; answers come back under the same ids.
			</p>
			<div class="trio">
				<div class="box choice">
					<h3>Choice <span class="tag">pick one</span></h3>
					<p><code>criteria</code> is an object of option → description (description may be <code>null</code>). The model picks one option.</p>
					<p class="ret">→ <code>choice</code> + <code>probabilities</code> per option + <code>confidence</code></p>
					<p>Classification, routing, intent detection, “which handler should take this?”.</p>
				</div>
				<div class="box score">
					<h3>Score <span class="tag">rate on a scale</span></h3>
					<p><code>criteria</code> is an ordered array of level descriptions, low to high. The answer is interpolated between levels.</p>
					<p class="ret">→ <code>score</code> + <code>legend</code> (index → level) + <code>probabilities</code> per level + <code>confidence</code></p>
					<p>Severity, quality, relevance, mood: anything with a gradient. Weighted sums of several scores make a composite.</p>
				</div>
				<div class="box noul">
					<h3>Noul <span class="tag">true or false</span></h3>
					<p>A yes/no question with optional <code>criteria: {'{'} true, false {'}'}</code> to pin down what each side means (give both or neither).</p>
					<p class="ret">→ <code>noul</code>: probability of true, from 0 to 1</p>
					<p>Guards, checks, gates. The Vercel AI SDK calls this type <code>boolean</code> and returns it as <code>probability</code>.</p>
				</div>
			</div>
			<p>
				TypeSafe’s advice is to keep each question atomic: one specific, well-scoped thing that a knowledgeable person could answer
				in a few seconds. If a judgment needs reasoning, split it into factors, ask each as its own question, and combine the answers
				in code.
			</p>
		</section>

		<section id="patterns">
			<h2>Patterns TypeSafe recommends</h2>
			<div class="trio">
				<div class="box pattern">
					<h3>Speculative fan-out</h3>
					<p>
						Ask every independent question you <em>might</em> need in one call, including the speculative ones (“if this is a bug, how
						severe?”), and let code keep only the answers that matter. Output is free and questions run in parallel, so extra
						questions cost little more than the state tokens you already paid for.
					</p>
				</div>
				<div class="box pattern">
					<h3>Confidence-gated routing</h3>
					<p>
						Use confidence as a second axis. High confidence: act automatically. Low confidence: fall back to a broader category,
						ask a stronger model, or hand the case to a human. Choice and score answers report confidence; for noul, distance
						from 0.5 plays the same role.
					</p>
				</div>
				<div class="box pattern">
					<h3>Keep control in code</h3>
					<p>
						Rules, lookups, thresholds and execution stay in ordinary code. The model answers narrow questions; your program
						decides what to do with them. That keeps systems testable and makes “why did it do that?” a question about your
						thresholds, not about a prompt.
					</p>
				</div>
			</div>
			<p>
				The playground’s <a href="/">ticket-triage scenario</a> is a fan-out: five questions in one call, including “if this is a bug,
				how severe?”. The playground shows every answer; an app would read the severity only when the category came back as
				<code>bug</code>. The docs go further with composite scoring, intent routing and self-consistency checks; see
				<a href={DOCS} target="_blank" rel="noreferrer">docs.typesafe.ai</a>.
			</p>
		</section>

		<section id="pricing">
			<h2>Pricing and vendor claims</h2>
			<table class="claims">
				<thead><tr><th scope="col">What</th><th scope="col">TypeSafe says</th><th scope="col">Note</th></tr></thead>
				<tbody>
					<tr><td>Input tokens</td><td class="num">${PRICE_PER_MTOK_INPUT} / M</td><td>List price; the playground estimates cost per call from input tokens unless the provider reports it.</td></tr>
					<tr><td>Output tokens</td><td class="num">free</td><td>There is no generated text to meter, so the number of questions does not change the price.</td></tr>
					<tr><td>Latency</td><td class="num">70–500 ms</td><td>Claimed end-to-end. The playground shows server-side and end-to-end latency for every call, so you can compare on your own network.</td></tr>
					<tr><td>Calibration</td><td class="num">“calibrated”</td><td>Higher confidence should mean higher accuracy, and similar inputs similar answers. Worth checking against a labelled sample before you rely on it.</td></tr>
				</tbody>
			</table>
			<p class="note">
				Prices, latency and calibration figures above are TypeSafe’s own statements from its announcement post and docs, as of
				{PUBLISHED}. This site is an independent playground and has not benchmarked them; treat them as vendor claims.
				Providers other than TypeSafe may charge differently.
			</p>
		</section>

		<section id="call-it">
			<h2>Three ways to call it</h2>
			<p>
				The playground talks to Jev through three providers, and the snippets below are trimmed straight from its
				<a href={`${REPO_URL}/blob/main/src/lib/server/providers.ts`} target="_blank" rel="noreferrer">adapter code</a>. The same
				request works everywhere; only model ids, the noul spelling and usage field names differ.
			</p>
			<h3>The request</h3>
			<pre class="raw"><code>{request}</code></pre>

			<div class="provider">
				<div class="head">
					<h3>OpenRouter</h3>
					<div class="tags"><span class="tag ink">{MODEL_IDS.openrouter}</span><span class="tag">@openrouter/sdk · alpha.decisions.create</span></div>
				</div>
				<pre class="raw"><code>{exOpenRouter}</code></pre>
			</div>

			<div class="provider">
				<div class="head">
					<h3>Vercel AI Gateway</h3>
					<div class="tags"><span class="tag ink">{MODEL_IDS.vercel}</span><span class="tag">ai · experimental_evaluate</span></div>
				</div>
				<pre class="raw"><code>{exVercel}</code></pre>
			</div>

			<div class="provider">
				<div class="head">
					<h3>TypeSafe API</h3>
					<div class="tags"><span class="tag ink">{MODEL_IDS.typesafe}</span><span class="tag">POST /v1/systemone</span></div>
				</div>
				<pre class="raw"><code>{exTypeSafe}</code></pre>
			</div>

			<h3>The response, normalized</h3>
			<p>
				OpenRouter and TypeSafe return this shape natively (TypeSafe with <code>input_tokens</code>); the playground maps the AI SDK’s
				<code>boolean</code> / <code>probability</code> and <code>providerMetadata.typesafe.confidence</code> onto it. Values are
				illustrative.
			</p>
			<pre class="raw"><code>{answers}</code></pre>
		</section>

		<section id="when">
			<h2>When to use it, and when not to</h2>
			<div class="duo">
				<div class="box yes">
					<h3>Reach for Jev when</h3>
					<ul>
						<li>You need a <strong>decision</strong>, not a document: classify, route, score, verify, extract from a fixed set.</li>
						<li>The answer space can be <strong>designed up front</strong> as options, levels or a yes/no.</li>
						<li>Latency and cost matter: real-time paths, guardrails in front of or behind an LLM, map-reduce over large data.</li>
						<li>You want <strong>probabilities</strong> to threshold, sort by, or gate on, rather than a confident-sounding sentence.</li>
					</ul>
				</div>
				<div class="box no">
					<h3>Look elsewhere when</h3>
					<ul>
						<li>You need an <strong>explanation</strong>: Jev gives numbers, never a rationale.</li>
						<li>You need <strong>generation</strong>: summaries, rewrites, code, replies. Pair it with an LLM instead.</li>
						<li>The set of possible answers is <strong>open-ended</strong> or unknown until you see the input.</li>
						<li>You need to self-host or inspect weights: Jev is a <strong>hosted, closed-weights API</strong>.</li>
					</ul>
				</div>
			</div>
		</section>

		<section id="try">
			<h2>Try it in one minute</h2>
			<ol class="steps">
				<li>Get a key from <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">OpenRouter</a>, <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noreferrer">Vercel AI Gateway</a> or <a href="https://typesafe.ai" target="_blank" rel="noreferrer">TypeSafe</a>.</li>
				<li>Open the <a href="/">playground</a>, pick the provider in the top bar and paste the key. It stays in your browser’s localStorage and is forwarded per request; this site never stores it.</li>
				<li>Pick a scenario, swap the state with one of the variants, hit Evaluate, and watch the probabilities move.</li>
			</ol>
		</section>

		<footer class="foot">
			<a href="/">Playground</a>
			<a href={DOCS} target="_blank" rel="noreferrer">docs.typesafe.ai</a>
			<a href={BLOG} target="_blank" rel="noreferrer">Introducing System One models and Jev</a>
			<a href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a>
		</footer>
	</article>
</div>

<script lang="ts">
	import Seo from '$lib/Seo.svelte';
	import PageHeader from '$lib/PageHeader.svelte';
	import { recipes, type Recipe } from '$lib/cookbook';
	import { MODEL_IDS } from '$lib/types';
	import { SITE_URL } from '$lib/site';

	const title = 'Jev cookbook · copy-paste request bodies for routing, guardrails, scoring and more';
	const description =
		'Eleven ready-to-run Jev requests, one per pattern: speculative fan-out, confidence-gated routing, composite scoring, model routing, LLM guardrails, output verification, citation checks, re-ranking, value extraction, function calling and self-consistency. Copy the JSON or a curl command, or open any recipe in the playground.';

	const jsonLd = [
		{
			'@type': 'TechArticle',
			headline: title,
			description,
			url: `${SITE_URL}/cookbook`,
			mainEntityOfPage: `${SITE_URL}/cookbook`,
			image: `${SITE_URL}/og-cookbook.png`,
			datePublished: '2026-09-20',
			dateModified: '2026-09-20',
			inLanguage: 'en',
			author: { '@type': 'Person', name: 'VerySmallWoods', url: 'https://x.com/verysmallwoods' },
			publisher: { '@type': 'Organization', name: 'tryjev', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
			about: { '@type': 'SoftwareApplication', name: 'Jev', applicationCategory: 'DeveloperApplication', creator: { '@type': 'Organization', name: 'TypeSafe AI', url: 'https://typesafe.ai' } }
		},
		{
			'@type': 'ItemList',
			name: 'Jev cookbook recipes',
			itemListOrder: 'https://schema.org/ItemListOrderAscending',
			numberOfItems: recipes.length,
			itemListElement: recipes.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.title, url: `${SITE_URL}/cookbook#${r.id}` }))
		},
		{
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Jev Playground', item: `${SITE_URL}/` },
				{ '@type': 'ListItem', position: 2, name: 'Cookbook', item: `${SITE_URL}/cookbook` }
			]
		}
	];

	const bodyOf = (r: Recipe) => JSON.stringify({ model: MODEL_IDS.typesafe, ...r.request }, null, 2);
	// TypeSafe's own endpoint; swap the URL, header and model id for OpenRouter (see /jev for all three)
	const curlOf = (r: Recipe) =>
		`curl https://api.typesafe.ai/v1/systemone \\\n  -H "Authorization: Bearer $TYPESAFE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${bodyOf(r).replace(/'/g, `'\\''`)}'`;

	let copied = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	// Clipboard API first; hidden-textarea fallback for browsers that deny it outside a secure context
	function copyFallback(text: string) {
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.setAttribute('readonly', '');
		ta.style.position = 'fixed';
		ta.style.opacity = '0';
		document.body.appendChild(ta);
		ta.select();
		const ok = document.execCommand('copy');
		ta.remove();
		return ok;
	}
	async function copy(key: string, text: string) {
		let ok = false;
		try {
			await navigator.clipboard.writeText(text);
			ok = true;
		} catch {
			ok = copyFallback(text);
		}
		copied = ok ? key : null;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = null), 1600);
	}
</script>

<Seo
	{title}
	{description}
	path="/cookbook"
	type="article"
	image="/og-cookbook.png"
	imageAlt="JEV cookbook · copy-paste request bodies: fan-out, routing, guardrails, scoring"
	keywords="Jev cookbook, Jev examples, System One model examples, speculative fan-out, confidence-gated routing, composite scoring, LLM guardrails, re-ranking, function calling, TypeSafe API request body, curl"
	{jsonLd}
/>

<div class="app page">
	<PageHeader sub="Cookbook · one request body per pattern" current="/cookbook" />

	<article class="article">
		<section class="hero">
			<span class="kicker">Cookbook</span>
			<h1>Request bodies you can paste</h1>
			<p class="lede">
				{recipes.length} recipes, one per pattern from TypeSafe’s docs and the playground. Each gives you the JSON body, a curl command for
				<code>POST /v1/systemone</code>, and the few lines of code that turn the answers into a decision. Every recipe opens in the
				<a href="/">playground</a> with one click; nothing here needs more than a key.
			</p>
			<nav class="toc" aria-label="Recipes">
				{#each recipes as r (r.id)}
					<a href="#{r.id}" class="tag">{r.pattern}</a>
				{/each}
			</nav>
		</section>

		{#each recipes as r, i (r.id)}
			<section class="recipe" id={r.id} data-color={r.color}>
				<div class="head">
					<div>
						<span class="label">{String(i + 1).padStart(2, '0')} · {r.pattern}</span>
						<h2>{r.title}</h2>
					</div>
					<span class="tag">{r.tag}</span>
				</div>
				<p>{r.why}</p>
				<div class="actions">
					<a class="btn primary" href="/?recipe={r.id}">Open in playground</a>
					<button class="btn" onclick={() => copy(`${r.id}:json`, bodyOf(r))}>{copied === `${r.id}:json` ? 'Copied ✓' : 'Copy JSON'}</button>
					<button class="btn" onclick={() => copy(`${r.id}:curl`, curlOf(r))}>{copied === `${r.id}:curl` ? 'Copied ✓' : 'Copy curl'}</button>
				</div>
				<details class="body">
					<summary>Request body</summary>
					<pre class="raw"><code>{bodyOf(r)}</code></pre>
				</details>
				<div class="code">
					<span class="label">Then, in code</span>
					<pre class="raw"><code>{r.code}</code></pre>
				</div>
			</section>
		{/each}

		<section>
			<h2>Adapting a recipe</h2>
			<ul>
				<li>The bodies use TypeSafe’s model id <code>{MODEL_IDS.typesafe}</code>. For OpenRouter send the same <code>state</code> and <code>questions</code> to <code>alpha.decisions.create</code> with <code>{MODEL_IDS.openrouter}</code>; for the Vercel AI SDK use <code>{MODEL_IDS.vercel}</code> and spell noul questions as <code>type: "boolean"</code>. All three are shown on <a href="/jev#call-it">the Jev page</a>.</li>
				<li>Keep each question atomic. If you find yourself writing “and” in an instruction, split it in two and combine in code.</li>
				<li>Thresholds like <code>0.7</code> are starting points. Run a labelled sample through the playground and pick cut-offs from your own probabilities.</li>
				<li>Score answers come back on the index scale of your criteria (0 to n−1, interpolated), with per-level probabilities and a <code>legend</code>.</li>
			</ul>
		</section>

		<footer class="foot">
			<a href="/">Playground</a>
			<a href="/jev">What is Jev?</a>
			<a href="https://docs.typesafe.ai" target="_blank" rel="noreferrer">docs.typesafe.ai</a>
		</footer>
	</article>
</div>

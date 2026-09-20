<script lang="ts">
	import { onMount } from 'svelte';
	import { scenarios, type Scenario } from '$lib/scenarios';
	import { findRecipe } from '$lib/cookbook';
	import { MODEL_IDS, PROVIDERS, PRICE_PER_MTOK_INPUT, type Answer, type EvaluateResponse, type Input, type Provider, type Question } from '$lib/types';
	import Seo from '$lib/Seo.svelte';
	import ThemeSwitch from '$lib/ThemeSwitch.svelte';
	import SiteNav from '$lib/SiteNav.svelte';
	import { SITE_URL } from '$lib/site';

	const title = 'Jev Playground · typed decisions from a fast decision model';
	const description =
		'Try Jev, TypeSafe AI’s System One decision model, in the browser: give it a state and typed questions (noul, choice, score) and get back calibrated probabilities instead of text. Five preset scenarios; bring your own key from OpenRouter, Vercel AI Gateway or TypeSafe.';

	// ---------- editable question model ----------
	type QRow = {
		key: string;
		id: string;
		type: Question['type'];
		instructions: string;
		choice: { name: string; desc: string }[];
		score: string[];
		noul: { t: string; f: string };
	};
	let seq = 0;
	const nextKey = () => `q${++seq}`;

	function toRows(questions: Record<string, Question>): QRow[] {
		return Object.entries(questions).map(([id, q]) => ({
			key: nextKey(),
			id,
			type: q.type,
			instructions: q.instructions,
			choice: q.type === 'choice' ? Object.entries(q.criteria).map(([name, desc]) => ({ name, desc: desc ?? '' })) : [{ name: 'a', desc: '' }, { name: 'b', desc: '' }],
			score: q.type === 'score' ? [...q.criteria] : ['low', 'high'],
			noul: q.type === 'noul' ? { t: q.criteria?.true ?? '', f: q.criteria?.false ?? '' } : { t: '', f: '' }
		}));
	}

	function toQuestions(rows: QRow[]): Record<string, Question> {
		const out: Record<string, Question> = {};
		for (const r of rows) {
			const id = r.id.trim();
			if (!id) continue;
			if (r.type === 'choice') {
				const criteria: Record<string, string | null> = {};
				for (const c of r.choice) if (c.name.trim()) criteria[c.name.trim()] = c.desc.trim() || null;
				out[id] = { type: 'choice', instructions: r.instructions, criteria };
			} else if (r.type === 'score') {
				out[id] = { type: 'score', instructions: r.instructions, criteria: r.score.map((s) => s.trim()).filter(Boolean) };
			} else {
				// noul criteria: either both true/false or none
				const t = r.noul.t.trim(), f = r.noul.f.trim();
				out[id] = { type: 'noul', instructions: r.instructions, ...(t && f ? { criteria: { true: t, false: f } } : {}) };
			}
		}
		return out;
	}

	const stateToText = (state: Input) => (typeof state === 'string' ? state : JSON.stringify(state, null, 2));
	const fmtPct = (n: number) => `${(n * 100).toFixed(n * 100 < 10 ? 1 : 0)}%`;

	type Run = {
		n: number;
		request: { state: Input; questions: Record<string, Question> };
		response?: EvaluateResponse;
		error?: string;
		clientMs: number;
	};

	// ---------- state ----------
	let active = $state<Scenario>(scenarios[0]);
	let stateText = $state(stateToText(scenarios[0].request.state));
	let stateJson = $state(typeof scenarios[0].request.state !== 'string');
	let rows = $state<QRow[]>(toRows(scenarios[0].request.questions));
	let reqView = $state<'form' | 'json'>('form');
	let resView = $state<'cards' | 'json'>('cards');
	let busy = $state(false);
	let runs = $state<Run[]>([]);
	let current = $state<Run | null>(null);
	// BYOK: provider + per-provider keys live in localStorage only and ride along as request headers
	let provider = $state<Provider>('openrouter');
	let keys = $state<Record<Provider, string>>({ openrouter: '', vercel: '', typesafe: '' });
	let keyOpen = $state(false);
	let keyDraft = $state('');
	const apiKey = $derived(keys[provider]);
	const providerInfo = $derived(PROVIDERS.find((p) => p.id === provider)!);
	const keyMasked = $derived(apiKey ? `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}` : '');
	function persist() { try { localStorage.setItem('jev-provider', provider); localStorage.setItem('jev-keys', JSON.stringify(keys)); } catch {} }
	function saveKey() { keys[provider] = keyDraft.trim(); persist(); keyOpen = false; }
	function clearKey() { keyDraft = ''; saveKey(); }
	function pickProvider(p: Provider) { provider = p; keyDraft = keys[p]; persist(); }

	const stateJsonError = $derived.by(() => {
		if (!stateJson) return null;
		try { JSON.parse(stateText); return null; } catch (e) { return (e as Error).message; }
	});
	const requestBody = $derived.by(() => {
		let s: Input = stateText;
		if (stateJson) { try { s = JSON.parse(stateText) as Input; } catch { s = stateText; } }
		return { model: MODEL_IDS[provider], state: s, questions: toQuestions(rows) };
	});

	function loadScenario(s: Scenario) {
		active = s;
		stateText = stateToText(s.request.state);
		stateJson = typeof s.request.state !== 'string';
		rows = toRows(s.request.questions);
		reqView = 'form';
	}
	function loadVariant(state: Input) {
		stateText = stateToText(state);
		stateJson = typeof state !== 'string';
	}
	function addQuestion(type: Question['type']) {
		rows.push({ key: nextKey(), id: `${type}_${rows.length + 1}`, type, instructions: '', choice: [{ name: 'a', desc: '' }, { name: 'b', desc: '' }], score: ['low', 'medium', 'high'], noul: { t: '', f: '' } });
	}
	function removeRow(key: string) { rows = rows.filter((r) => r.key !== key); }

	async function run() {
		if (busy || stateJsonError || rows.length === 0) return;
		busy = true;
		const t0 = performance.now();
		const request = { state: requestBody.state, questions: requestBody.questions };
		const n = runs.length + 1;
		try {
			const res = await fetch('/api/evaluate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-provider': provider, ...(apiKey ? { 'x-api-key': apiKey } : {}) }, body: JSON.stringify(request) });
			const data = (await res.json()) as EvaluateResponse & { error?: string };
			const clientMs = Math.round(performance.now() - t0);
			const r: Run = res.ok ? { n, request, response: data, clientMs } : { n, request, error: data.error ?? `HTTP ${res.status}`, clientMs };
			runs = [r, ...runs];
			current = r;
		} catch (e) {
			const r: Run = { n, request, error: (e as Error).message, clientMs: Math.round(performance.now() - t0) };
			runs = [r, ...runs];
			current = r;
		} finally {
			busy = false;
		}
	}

	// provider + keys from localStorage (theme is handled in +layout.svelte); ?recipe= / ?scenario= preload a request
	onMount(() => {
		const q = new URLSearchParams(location.search);
		const recipe = findRecipe(q.get('recipe'));
		const preset = scenarios.find((s) => s.id === q.get('scenario'));
		if (recipe) loadScenario({ id: `recipe:${recipe.id}`, title: recipe.title, tag: recipe.tag, blurb: recipe.why, color: recipe.color, request: recipe.request });
		else if (preset) loadScenario(preset);
		try {
			const p = localStorage.getItem('jev-provider') as Provider | null;
			if (p && p in keys) provider = p;
			const k = localStorage.getItem('jev-keys');
			if (k) keys = { ...keys, ...(JSON.parse(k) as Partial<Record<Provider, string>>) };
			keyDraft = keys[provider];
		} catch {}
		const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void run(); } };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// ---------- response rendering ----------
	const sortedProbs = (p: Record<string, number>) => Object.entries(p).sort((x, y) => y[1] - x[1]);
	const scoreEntries = (p: Record<string, number>) => Object.entries(p).sort((x, y) => Number(x[0]) - Number(y[0]));
	const scoreLabels = (q?: Question) => (q && q.type === 'score' ? q.criteria : []);
	const scoreTop = (entries: [string, number][], a: { score: number }) => (entries.length ? entries.reduce((m, e) => (e[1] > m[1] ? e : m))[0] : String(Math.round(a.score)));
	const cost = (r: EvaluateResponse) => r.usage.cost ?? (r.usage.inputTokens / 1_000_000) * PRICE_PER_MTOK_INPUT;
	const confidences = (r: EvaluateResponse) => Object.entries(r.answers).flatMap(([id, a]) => (a.type !== 'noul' && typeof a.confidence === 'number' ? [[id, a.confidence] as const] : []));

	const jsonLd = [
		{
			'@type': 'WebApplication',
			name: 'Jev Playground',
			alternateName: 'tryjev',
			url: SITE_URL + '/',
			description,
			applicationCategory: 'DeveloperApplication',
			operatingSystem: 'Web',
			browserRequirements: 'Requires JavaScript',
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
			image: SITE_URL + '/og.png',
			about: { '@type': 'SoftwareApplication', name: 'Jev', url: 'https://typesafe.ai', applicationCategory: 'DeveloperApplication', creator: { '@type': 'Organization', name: 'TypeSafe AI', url: 'https://typesafe.ai' } }
		}
	];
</script>

<Seo {title} {description} path="/" imageAlt="JEV · Playground for the fast decision model" keywords="Jev, TypeSafe AI, System One model, decision model, noul, choice, score, OpenRouter, Vercel AI Gateway, playground" {jsonLd} />

<div class="app">
	<header class="topbar">
		<div class="title">
			<div>
				<h1>Jev Playground</h1>
				<p class="sub">TypeSafe AI’s System One decision model · state in, typed probabilities out · via {providerInfo.name}</p>
			</div>
			<SiteNav current="/" />
		</div>
		<div class="meta">
			<label class="provider-pick">
				<span class="label">Provider</span>
				<select class="field" value={provider} onchange={(e) => pickProvider((e.currentTarget as HTMLSelectElement).value as Provider)}>
					{#each PROVIDERS as p (p.id)}<option value={p.id}>{p.name}{keys[p.id] ? ' ✓' : ''}</option>{/each}
				</select>
			</label>
			<span class="tag ink">{MODEL_IDS[provider]}</span>
			<span class="tag">$0.042 / M input</span>
			<span class="tag">output free</span>
			<span class="tag">{provider === 'vercel' ? 'experimental_evaluate' : provider === 'typesafe' ? '/v1/systemone' : 'alpha.decisions'}</span>
			<ThemeSwitch />
			<button class="btn ghost keybtn {apiKey ? '' : 'missing'}" onclick={() => { keyDraft = apiKey; keyOpen = !keyOpen; }} title="Your API key stays in this browser">
				{apiKey ? `Key · ${keyMasked}` : 'Key · not set'}
			</button>
		</div>
	</header>

	{#if keyOpen}
		<div class="keypanel">
			<div class="section-head">
				<h2 class="h3">API key · bring your own</h2>
				<span class="tag">stored only in this browser's localStorage</span>
			</div>
			<div class="toggle providers">
				{#each PROVIDERS as p (p.id)}
					<button class={provider === p.id ? 'on' : ''} onclick={() => pickProvider(p.id)}>{p.name}{keys[p.id] ? ' ✓' : ''}</button>
				{/each}
			</div>
			<p class="body-note">Each request forwards the key in a header to {providerInfo.name}; the server never stores or logs it, and you can clear it here any time. Model: <code>{MODEL_IDS[provider]}</code>. Get a key at <a href={providerInfo.keysUrl} target="_blank" rel="noreferrer">{providerInfo.keysUrl.replace('https://', '')}</a>.</p>
			<div class="keyrow">
				<input class="field mono" type="password" placeholder={providerInfo.keyHint} bind:value={keyDraft} onkeydown={(e) => e.key === 'Enter' && saveKey()} />
				<button class="btn primary" onclick={saveKey}>Save locally</button>
				<button class="btn ghost" onclick={clearKey} disabled={!apiKey}>Clear</button>
			</div>
		</div>
	{/if}

	<div class="grid">
		<!-- scenarios -->
		<aside class="col">
			<h2 class="kicker">01 Scenarios</h2>
			{#if active.id.startsWith('recipe:')}
				<p class="from-cookbook">Loaded from the <a href="/cookbook#{active.id.slice(7)}">cookbook</a>: <strong>{active.title}</strong></p>
			{/if}
			<div class="scenarios">
				{#each scenarios as s (s.id)}
					<button data-color={s.color} class="scenario {active.id === s.id ? 'active' : ''}" onclick={() => loadScenario(s)}>
						<div class="t">{s.title}</div>
						<div class="tag">{s.tag}</div>
						<div class="blurb">{s.blurb}</div>
					</button>
				{/each}
			</div>
			{#if runs.length > 0}
				<div>
					<h3 class="label">History (click to revisit)</h3>
					<div class="history">
						{#each runs.slice(0, 8) as r (r.n)}
							<div class="hrow" role="button" tabindex="0" onclick={() => (current = r)} onkeydown={(e) => e.key === 'Enter' && (current = r)}>
								<span class="n">#{r.n}</span>
								<span class="s">{stateToText(r.request.state).replace(/\s+/g, ' ').slice(0, 40)}</span>
								<span class="ms">{r.error ? 'ERR' : `${r.response?.latencyMs} ms`}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</aside>

		<!-- request -->
		<section class="col">
			<div class="section-head">
				<h2 class="kicker">02 Request</h2>
				<div class="toggle">
					<button class={reqView === 'form' ? 'on' : ''} onclick={() => (reqView = 'form')}>Form</button>
					<button class={reqView === 'json' ? 'on' : ''} onclick={() => (reqView = 'json')}>JSON</button>
				</div>
			</div>

			<div class="runbar">
				<button class="btn primary" disabled={busy || !!stateJsonError || rows.length === 0} onclick={run}>
					{#if busy}<span class="spin"></span> Evaluating{:else}▶ Evaluate{/if}
				</button>
				<span class="hint">One request, {Object.keys(requestBody.questions).length} questions evaluated in parallel · ⌘⏎</span>
			</div>

			{#if reqView === 'json'}
				<pre class="raw">{JSON.stringify(requestBody, null, 2)}</pre>
			{:else}
				<div class="card">
					<div class="section-head">
						<h3>State</h3>
						<label class="state-mode"><input type="checkbox" bind:checked={stateJson} /> send as JSON</label>
					</div>
					{#if active.variants}
						<div class="variants">
							{#each active.variants as v (v.label)}
								<button class="btn ghost" onclick={() => loadVariant(v.state)}>{v.label}</button>
							{/each}
						</div>
					{/if}
					<textarea class="field {stateJson ? 'mono' : ''}" rows={stateJson ? 10 : 5} bind:value={stateText}></textarea>
					{#if stateJsonError}<div class="error" style="margin-top:10px;padding:8px">Invalid JSON: {stateJsonError}</div>{/if}
				</div>

				<div class="card">
					<div class="section-head">
						<h3>Questions</h3>
						<span class="tag">{rows.length} · one parallel call</span>
					</div>
					{#each rows as r (r.key)}
						<div class="qcard {r.type}">
							<button class="del" title="Remove" onclick={() => removeRow(r.key)}>×</button>
							<div class="row">
								<div><span class="label">id</span><input class="field mono" bind:value={r.id} /></div>
								<div>
									<span class="label">type</span>
									<select class="field" bind:value={r.type}>
										<option value="noul">noul</option>
										<option value="choice">choice</option>
										<option value="score">score</option>
									</select>
								</div>
							</div>
							<div style="margin-top:10px"><span class="label">instructions</span><input class="field" bind:value={r.instructions} /></div>

							{#if r.type === 'choice'}
								<div class="crit">
									<span class="label">criteria · option → description</span>
									{#each r.choice as c, i}
										<div class="line">
											<input class="field mono" bind:value={c.name} placeholder="option" />
											<input class="field" bind:value={c.desc} placeholder="description (optional)" />
											<button class="btn ghost" onclick={() => (r.choice = r.choice.filter((_, j) => j !== i))}>−</button>
										</div>
									{/each}
									<div><button class="btn ghost" onclick={() => r.choice.push({ name: '', desc: '' })}>+ option</button></div>
								</div>
							{:else if r.type === 'score'}
								<div class="crit">
									<span class="label">criteria · ordered levels, low to high</span>
									{#each r.score as _, i}
										<div class="line score">
											<span class="idx">{i}</span>
											<input class="field" bind:value={r.score[i]} />
											<button class="btn ghost" disabled={r.score.length <= 2} onclick={() => (r.score = r.score.filter((_, j) => j !== i))}>−</button>
										</div>
									{/each}
									<div><button class="btn ghost" onclick={() => r.score.push('')}>+ level</button></div>
								</div>
							{:else}
								<div class="crit">
									<span class="label">criteria · optional, what true / false mean (give both or neither)</span>
									<div class="line bool"><span class="idx">true</span><input class="field" bind:value={r.noul.t} placeholder="optional" /></div>
									<div class="line bool"><span class="idx">false</span><input class="field" bind:value={r.noul.f} placeholder="optional" /></div>
								</div>
							{/if}
						</div>
					{/each}
					<div class="addrow">
						<button class="btn" onclick={() => addQuestion('noul')}>+ noul</button>
						<button class="btn" onclick={() => addQuestion('choice')}>+ choice</button>
						<button class="btn" onclick={() => addQuestion('score')}>+ score</button>
					</div>
				</div>
			{/if}
		</section>

		<!-- response -->
		<section class="col sticky">
			<div class="section-head">
				<h2 class="kicker">03 Response</h2>
				<div class="toggle">
					<button class={resView === 'cards' ? 'on' : ''} onclick={() => (resView = 'cards')}>Cards</button>
					<button class={resView === 'json' ? 'on' : ''} onclick={() => (resView = 'json')}>JSON</button>
				</div>
			</div>

			{#if !current}
				<p class="empty">Hit Evaluate and the probabilities land here.</p>
			{:else if current.error}
				<div class="error">{current.error}</div>
			{:else if current.response && resView === 'json'}
				<pre class="raw">{JSON.stringify(current.response, null, 2)}</pre>
			{:else if current.response}
				{@const res = current.response}
				<div class="stats">
					<div class="stat"><span class="dot"></span><div class="k">latency · server</div><div class="v">{res.latencyMs}<small>ms</small></div></div>
					<div class="stat"><span class="dot"></span><div class="k">latency · end to end</div><div class="v">{current.clientMs}<small>ms</small></div></div>
					<div class="stat"><span class="dot"></span><div class="k">input tokens</div><div class="v">{res.usage.inputTokens}</div></div>
					<div class="stat"><span class="dot"></span><div class="k">cost</div><div class="v" style="font-size:20px">${cost(res).toFixed(7)}</div></div>
				</div>

				{#each Object.entries(res.answers) as [id, a] (id)}
					{@const q = current.request.questions[id]}
					{#if a.type === 'noul'}
						<div class="answer">
							<div class="head">
								<div><span class="tag">noul</span> <span class="id">{id}</span></div>
								<div class="big">{fmtPct(a.noul)}<small> true</small></div>
							</div>
							{#if q}<div class="q">{q.instructions}</div>{/if}
							<div class="meter"><div class="fill {a.noul < 0.35 ? 'low' : a.noul < 0.65 ? 'mid' : ''}" style="width:{a.noul * 100}%"></div><div class="mid-line"></div></div>
						</div>
					{:else if a.type === 'choice'}
						<div class="answer">
							<div class="head">
								<div><span class="tag">choice</span> <span class="id">{id}</span></div>
								<div class="big" style="font-size:28px">{a.choice}</div>
							</div>
							{#if q}<div class="q">{q.instructions}</div>{/if}
							<div class="bars">
								{#each sortedProbs(a.probabilities ?? { [a.choice]: 1 }) as [name, p] (name)}
									<div class="bar {name === a.choice ? 'win' : ''}">
										<span class="name">{name}</span>
										<div class="track"><div class="fill" style="width:{p * 100}%"></div></div>
										<span class="pct">{fmtPct(p)}</span>
									</div>
								{/each}
							</div>
						</div>
					{:else if a.type === 'score'}
						{@const entries = scoreEntries(a.probabilities ?? {})}
						{@const labels = scoreLabels(q)}
						{@const top = scoreTop(entries, a)}
						{@const max = Math.max(labels.length - 1, entries.length - 1, 1)}
						<div class="answer">
							<div class="head">
								<div><span class="tag">score</span> <span class="id">{id}</span></div>
								<div class="big">{a.score.toFixed(2)}<small> / {max}</small></div>
							</div>
							{#if q}<div class="q">{q.instructions}</div>{/if}
							<div class="bars">
								{#each entries as [idx, p] (idx)}
									<div class="bar score {idx === top ? 'win' : ''}">
										<span class="name">{idx} · {(labels[Number(idx)] ?? a.legend?.[idx] ?? '').split(':')[0]}</span>
										<div class="track"><div class="fill" style="width:{p * 100}%"></div></div>
										<span class="pct">{fmtPct(p)}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}

				{#if confidences(res).length}
					<div class="card small">
						<span class="label">confidence (comes with choice / score)</span>
						<div class="conf">
							{#each confidences(res) as [k, v] (k)}
								<span class="tag {v < 0.3 ? 'accent' : 'ink'}">{k}: {v.toFixed(2)}</span>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</section>
	</div>
</div>

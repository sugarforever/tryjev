<script lang="ts">
	import { onMount } from 'svelte';
	import { scenarios, type Scenario } from '$lib/scenarios';
	import { MODEL_ID, PRICE_PER_MTOK_INPUT, type Answer, type EvaluateResponse, type Input, type Question } from '$lib/types';

	// ---------- 可编辑的问题模型 ----------
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
				// noul 的 criteria 要么 true/false 都给，要么不给
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

	// ---------- 状态 ----------
	let active = $state<Scenario>(scenarios[0]);
	let stateText = $state(stateToText(scenarios[0].request.state));
	let stateJson = $state(typeof scenarios[0].request.state !== 'string');
	let rows = $state<QRow[]>(toRows(scenarios[0].request.questions));
	let reqView = $state<'form' | 'json'>('form');
	let resView = $state<'cards' | 'json'>('cards');
	let busy = $state(false);
	let runs = $state<Run[]>([]);
	let current = $state<Run | null>(null);
	let theme = $state<'swiss' | 'candy'>('swiss');
	// BYOK：key 只放 localStorage，随请求头发给 /api/evaluate
	let apiKey = $state('');
	let keyOpen = $state(false);
	let keyDraft = $state('');
	const keyMasked = $derived(apiKey ? `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}` : '');
	function saveKey() { apiKey = keyDraft.trim(); try { apiKey ? localStorage.setItem('openrouter-key', apiKey) : localStorage.removeItem('openrouter-key'); } catch {} keyOpen = false; }
	function clearKey() { keyDraft = ''; saveKey(); }

	const stateJsonError = $derived.by(() => {
		if (!stateJson) return null;
		try { JSON.parse(stateText); return null; } catch (e) { return (e as Error).message; }
	});
	const requestBody = $derived.by(() => {
		let s: Input = stateText;
		if (stateJson) { try { s = JSON.parse(stateText) as Input; } catch { s = stateText; } }
		return { model: MODEL_ID, state: s, questions: toQuestions(rows) };
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
			const res = await fetch('/api/evaluate', { method: 'POST', headers: { 'content-type': 'application/json', ...(apiKey ? { 'x-openrouter-key': apiKey } : {}) }, body: JSON.stringify(request) });
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

	// 主题：?theme=candy 优先，其次 localStorage；写到 <html data-theme>
	onMount(() => {
		const fromUrl = new URLSearchParams(location.search).get('theme');
		try {
			apiKey = localStorage.getItem('openrouter-key') ?? '';
			keyDraft = apiKey;
			const saved = localStorage.getItem('jev-theme');
			if (fromUrl === 'candy' || fromUrl === 'swiss') theme = fromUrl;
			else if (saved === 'candy' || saved === 'swiss') theme = saved;
		} catch {}
		const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void run(); } };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
	$effect(() => {
		document.documentElement.dataset.theme = theme;
		try { localStorage.setItem('jev-theme', theme); } catch {}
	});

	// ---------- 响应展示 ----------
	const sortedProbs = (p: Record<string, number>) => Object.entries(p).sort((x, y) => y[1] - x[1]);
	const scoreEntries = (p: Record<string, number>) => Object.entries(p).sort((x, y) => Number(x[0]) - Number(y[0]));
	const scoreLabels = (q?: Question) => (q && q.type === 'score' ? q.criteria : []);
	const scoreTop = (entries: [string, number][], a: { score: number }) => (entries.length ? entries.reduce((m, e) => (e[1] > m[1] ? e : m))[0] : String(Math.round(a.score)));
	const cost = (r: EvaluateResponse) => r.usage.cost ?? (r.usage.inputTokens / 1_000_000) * PRICE_PER_MTOK_INPUT;
	const confidences = (r: EvaluateResponse) => Object.entries(r.answers).flatMap(([id, a]) => (a.type !== 'noul' && typeof a.confidence === 'number' ? [[id, a.confidence] as const] : []));
</script>

<div class="app">
	<header class="topbar">
		<div class="title">
			<div>
				<h1>Jev Playground</h1>
				<div class="sub">State in · typed probabilities out · via OpenRouter</div>
			</div>
		</div>
		<div class="meta">
			<span class="tag ink">{MODEL_ID}</span>
			<span class="tag">$0.042 / M input</span>
			<span class="tag">output free</span>
			<span class="tag">alpha.decisions</span>
			<span class="theme-switch">
				<button class={theme === 'swiss' ? 'on' : ''} onclick={() => (theme = 'swiss')}>Swiss</button>
				<button class={theme === 'candy' ? 'on' : ''} onclick={() => (theme = 'candy')}>Candy</button>
			</span>
			<button class="btn ghost keybtn {apiKey ? '' : 'missing'}" onclick={() => { keyDraft = apiKey; keyOpen = !keyOpen; }} title="OpenRouter API key，只存在你的浏览器里">
				{apiKey ? `Key · ${keyMasked}` : 'Key · 未设置'}
			</button>
		</div>
	</header>

	{#if keyOpen}
		<div class="keypanel">
			<div class="section-head">
				<h3>OpenRouter API key · BYOK</h3>
				<span class="tag">只存在这台浏览器的 localStorage</span>
			</div>
			<p class="body-note">每次请求把它放在请求头里转给 OpenRouter，服务端不保存、不记录。用完可以在这里清掉。到 <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">openrouter.ai/settings/keys</a> 创建一个。</p>
			<div class="keyrow">
				<input class="field mono" type="password" placeholder="sk-or-v1-…" bind:value={keyDraft} onkeydown={(e) => e.key === 'Enter' && saveKey()} />
				<button class="btn primary" onclick={saveKey}>保存到本地</button>
				<button class="btn ghost" onclick={clearKey} disabled={!apiKey}>清除</button>
			</div>
		</div>
	{/if}

	<div class="grid">
		<!-- 场景 -->
		<aside class="col">
			<span class="kicker">01 场景</span>
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
					<span class="label">历史（点一下回看）</span>
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

		<!-- 请求 -->
		<section class="col">
			<div class="section-head">
				<span class="kicker">02 请求</span>
				<div class="toggle">
					<button class={reqView === 'form' ? 'on' : ''} onclick={() => (reqView = 'form')}>表单</button>
					<button class={reqView === 'json' ? 'on' : ''} onclick={() => (reqView = 'json')}>JSON</button>
				</div>
			</div>

			<div class="runbar">
				<button class="btn primary" disabled={busy || !!stateJsonError || rows.length === 0} onclick={run}>
					{#if busy}<span class="spin"></span> 评估中{:else}▶ Evaluate{/if}
				</button>
				<span class="hint">一次请求，{Object.keys(requestBody.questions).length} 个问题并行评估 · ⌘⏎</span>
			</div>

			{#if reqView === 'json'}
				<pre class="raw">{JSON.stringify(requestBody, null, 2)}</pre>
			{:else}
				<div class="card">
					<div class="section-head">
						<h3>State · 状态</h3>
						<label class="state-mode"><input type="checkbox" bind:checked={stateJson} /> 作为 JSON 发送</label>
					</div>
					{#if active.variants}
						<div class="variants">
							{#each active.variants as v (v.label)}
								<button class="btn ghost" onclick={() => loadVariant(v.state)}>{v.label}</button>
							{/each}
						</div>
					{/if}
					<textarea class="field {stateJson ? 'mono' : ''}" rows={stateJson ? 10 : 5} bind:value={stateText}></textarea>
					{#if stateJsonError}<div class="error" style="margin-top:10px;padding:8px">JSON 解析失败：{stateJsonError}</div>{/if}
				</div>

				<div class="card">
					<div class="section-head">
						<h3>Questions · 问题</h3>
						<span class="tag">{rows.length} 个 · 一次并发</span>
					</div>
					{#each rows as r (r.key)}
						<div class="qcard {r.type}">
							<button class="del" title="删除" onclick={() => removeRow(r.key)}>×</button>
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
									<span class="label">criteria · 选项 → 描述</span>
									{#each r.choice as c, i}
										<div class="line">
											<input class="field mono" bind:value={c.name} placeholder="option" />
											<input class="field" bind:value={c.desc} placeholder="描述（可空）" />
											<button class="btn ghost" onclick={() => (r.choice = r.choice.filter((_, j) => j !== i))}>−</button>
										</div>
									{/each}
									<div><button class="btn ghost" onclick={() => r.choice.push({ name: '', desc: '' })}>+ 选项</button></div>
								</div>
							{:else if r.type === 'score'}
								<div class="crit">
									<span class="label">criteria · 有序档位，从低到高</span>
									{#each r.score as _, i}
										<div class="line score">
											<span class="idx">{i}</span>
											<input class="field" bind:value={r.score[i]} />
											<button class="btn ghost" disabled={r.score.length <= 2} onclick={() => (r.score = r.score.filter((_, j) => j !== i))}>−</button>
										</div>
									{/each}
									<div><button class="btn ghost" onclick={() => r.score.push('')}>+ 档位</button></div>
								</div>
							{:else}
								<div class="crit">
									<span class="label">criteria · 可选，说明 true / false 各指什么（要给就两个都给）</span>
									<div class="line bool"><span class="idx">true</span><input class="field" bind:value={r.noul.t} placeholder="可空" /></div>
									<div class="line bool"><span class="idx">false</span><input class="field" bind:value={r.noul.f} placeholder="可空" /></div>
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

		<!-- 响应 -->
		<section class="col sticky">
			<div class="section-head">
				<span class="kicker">03 响应</span>
				<div class="toggle">
					<button class={resView === 'cards' ? 'on' : ''} onclick={() => (resView = 'cards')}>图</button>
					<button class={resView === 'json' ? 'on' : ''} onclick={() => (resView = 'json')}>JSON</button>
				</div>
			</div>

			{#if !current}
				<div class="empty">点 Evaluate，这里出概率。</div>
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
						<span class="label">confidence（choice / score 附带）</span>
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

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { OpenRouter } from '@openrouter/sdk';
import { MODEL_ID, type EvaluateRequest, type EvaluateResponse } from '$lib/types';

// 唯一的服务端代码：把 state + questions 交给 OpenRouter 的 decisions 接口，顺便计时
// BYOK：浏览器把自己的 key 放在 x-openrouter-key 头里带过来，只用于这一次请求，服务端不落盘不记录；
// 没带的话退回到服务端环境变量（自己部署时可以不开放 BYOK）
export async function POST({ request }) {
	const apiKey = request.headers.get('x-openrouter-key')?.trim() || env.OPENROUTER_API_KEY;
	if (!apiKey) {
		return json({ error: '没有 OpenRouter key：点右上角「Key」填一个，只存在你的浏览器里' }, { status: 401 });
	}
	let body: EvaluateRequest;
	try {
		body = (await request.json()) as EvaluateRequest;
	} catch {
		return json({ error: '请求体不是合法 JSON' }, { status: 400 });
	}
	if (!body.questions || Object.keys(body.questions).length === 0) {
		return json({ error: '至少需要一个问题' }, { status: 400 });
	}

	const openrouter = new OpenRouter({ apiKey });
	const started = performance.now();
	try {
		const decision = await openrouter.alpha.decisions.create({
			decisionsRequest: { model: env.JEV_MODEL ?? MODEL_ID, state: body.state, questions: body.questions }
		});
		const payload: EvaluateResponse = {
			id: decision.id,
			model: decision.model,
			provider: decision.provider,
			answers: decision.answers as EvaluateResponse['answers'],
			usage: decision.usage,
			latencyMs: Math.round(performance.now() - started)
		};
		return json(payload);
	} catch (e) {
		const err = e as Error & { statusCode?: number; body?: string };
		const status = err.statusCode === 401 || err.statusCode === 403 ? 401 : 502;
		return json({ error: err.message || String(e), detail: err.body }, { status });
	}
}

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { OpenRouter } from '@openrouter/sdk';
import { MODEL_ID, type EvaluateRequest, type EvaluateResponse } from '$lib/types';

// 唯一的服务端代码：把 state + questions 交给 OpenRouter 的 decisions 接口，顺便计时
export async function POST({ request }) {
	if (!env.OPENROUTER_API_KEY) {
		return json({ error: '未设置 OPENROUTER_API_KEY 环境变量' }, { status: 500 });
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

	const openrouter = new OpenRouter({ apiKey: env.OPENROUTER_API_KEY });
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
		return json({ error: err.message || String(e), detail: err.body }, { status: 502 });
	}
}

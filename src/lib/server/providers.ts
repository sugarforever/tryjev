// 三家服务商的适配：都收同一份 { state, questions }，都吐同一份 EvaluateResponse。
import { OpenRouter } from '@openrouter/sdk';
import { experimental_evaluate as evaluate } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import type { Answer, EvaluateRequest, EvaluateResponse, Provider, Question } from '$lib/types';
import { MODEL_IDS } from '$lib/types';

type Raw = { answers: Record<string, Answer>; usage: { inputTokens: number; outputTokens: number; cost?: number }; model: string; id?: string; provider?: string };

async function viaOpenRouter(apiKey: string, req: EvaluateRequest, model: string): Promise<Raw> {
	const client = new OpenRouter({ apiKey });
	const d = await client.alpha.decisions.create({ decisionsRequest: { model, state: req.state, questions: req.questions } });
	return { answers: d.answers as Record<string, Answer>, usage: d.usage, model: d.model, id: d.id, provider: d.provider };
}

// TypeSafe 官方 API：和 OpenRouter 的 decisions 是同一套字段，只是 usage 用 snake_case
async function viaTypeSafe(apiKey: string, req: EvaluateRequest, model: string): Promise<Raw> {
	const res = await fetch('https://api.typesafe.ai/v1/systemone', {
		method: 'POST',
		headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
		body: JSON.stringify({ model, state: req.state, questions: req.questions })
	});
	const text = await res.text();
	if (!res.ok) throw Object.assign(new Error(`TypeSafe API ${res.status}: ${text.slice(0, 300)}`), { statusCode: res.status, body: text });
	const d = JSON.parse(text) as { model: string; answers: Record<string, Answer>; usage: { input_tokens: number; output_tokens: number } };
	return { answers: d.answers, usage: { inputTokens: d.usage.input_tokens, outputTokens: d.usage.output_tokens }, model: d.model, provider: 'typesafe' };
}

// Vercel AI Gateway：走 AI SDK 的 experimental_evaluate；那边 noul 叫 boolean，confidence 在 providerMetadata 里
async function viaVercel(apiKey: string, req: EvaluateRequest, model: string): Promise<Raw> {
	const gateway = createGateway({ apiKey });
	const questions: Record<string, unknown> = {};
	for (const [id, q] of Object.entries(req.questions)) {
		questions[id] = q.type === 'noul' ? { type: 'boolean', instructions: q.instructions, ...(q.criteria ? { criteria: q.criteria } : {}) } : q;
	}
	const r = await evaluate({ model: gateway.evaluationModel(model), state: req.state, questions: questions as Parameters<typeof evaluate>[0]['questions'], maxRetries: 0 });
	const conf = ((r.providerMetadata as { typesafe?: { confidence?: Record<string, number> } } | undefined)?.typesafe?.confidence) ?? {};
	const answers: Record<string, Answer> = {};
	for (const [id, a] of Object.entries(r.answers as Record<string, { type: string; probability?: number; choice?: string; score?: number; probabilities?: Record<string, number> }>)) {
		if (a.type === 'boolean') answers[id] = { type: 'noul', noul: a.probability ?? 0 };
		else if (a.type === 'choice') answers[id] = { type: 'choice', choice: a.choice ?? '', probabilities: a.probabilities, confidence: conf[id] };
		else answers[id] = { type: 'score', score: a.score ?? 0, probabilities: a.probabilities, confidence: conf[id] };
	}
	return { answers, usage: { inputTokens: r.usage.inputTokens ?? 0, outputTokens: r.usage.outputTokens ?? 0 }, model: r.response.modelId, provider: 'vercel-ai-gateway' };
}

export async function runEvaluate(provider: Provider, apiKey: string, req: EvaluateRequest, modelOverride?: string): Promise<EvaluateResponse> {
	const model = modelOverride || MODEL_IDS[provider];
	const started = performance.now();
	const raw = provider === 'openrouter' ? await viaOpenRouter(apiKey, req, model) : provider === 'typesafe' ? await viaTypeSafe(apiKey, req, model) : await viaVercel(apiKey, req, model);
	return { ...raw, providerKind: provider, latencyMs: Math.round(performance.now() - started) };
}

export type { Question };

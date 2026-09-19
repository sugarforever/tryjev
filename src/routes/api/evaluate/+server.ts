import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { runEvaluate } from '$lib/server/providers';
import type { EvaluateRequest, Provider } from '$lib/types';

// BYOK：浏览器把服务商和 key 放在请求头里带过来，只用于这一次请求，服务端不落盘不记录；
// 没带 key 时退回到对应的服务端环境变量（自己部署时可以不开放 BYOK）
const ENV_KEYS: Record<Provider, string | undefined> = {
	openrouter: env.OPENROUTER_API_KEY,
	vercel: env.AI_GATEWAY_API_KEY,
	typesafe: env.TYPESAFE_API_KEY
};

export async function POST({ request }) {
	const provider = (request.headers.get('x-provider') ?? 'openrouter') as Provider;
	if (!(provider in ENV_KEYS)) return json({ error: `未知服务商：${provider}` }, { status: 400 });
	const apiKey = request.headers.get('x-api-key')?.trim() || ENV_KEYS[provider];
	if (!apiKey) return json({ error: '没有 API key：点右上角「Key」选服务商填一个，只存在你的浏览器里' }, { status: 401 });

	let body: EvaluateRequest;
	try {
		body = (await request.json()) as EvaluateRequest;
	} catch {
		return json({ error: '请求体不是合法 JSON' }, { status: 400 });
	}
	if (!body.questions || Object.keys(body.questions).length === 0) return json({ error: '至少需要一个问题' }, { status: 400 });

	try {
		return json(await runEvaluate(provider, apiKey, body, env.JEV_MODEL));
	} catch (e) {
		const err = e as Error & { statusCode?: number; body?: string };
		const status = err.statusCode === 401 || err.statusCode === 403 ? 401 : 502;
		return json({ error: err.message || String(e), detail: err.body }, { status });
	}
}

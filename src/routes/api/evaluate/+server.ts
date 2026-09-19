import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { runEvaluate } from '$lib/server/providers';
import type { EvaluateRequest, Provider } from '$lib/types';

// BYOK: the browser sends provider + key in headers, used for this one request only and never stored;
// without a header key we fall back to the matching server env var (for private deployments)
const ENV_KEYS: Record<Provider, string | undefined> = {
	openrouter: env.OPENROUTER_API_KEY,
	vercel: env.AI_GATEWAY_API_KEY,
	typesafe: env.TYPESAFE_API_KEY
};

export async function POST({ request }) {
	const provider = (request.headers.get('x-provider') ?? 'openrouter') as Provider;
	if (!(provider in ENV_KEYS)) return json({ error: `Unknown provider: ${provider}` }, { status: 400 });
	const apiKey = request.headers.get('x-api-key')?.trim() || ENV_KEYS[provider];
	if (!apiKey) return json({ error: 'No API key: pick a provider and paste a key via the Key button (it stays in your browser)' }, { status: 401 });

	let body: EvaluateRequest;
	try {
		body = (await request.json()) as EvaluateRequest;
	} catch {
		return json({ error: 'Request body is not valid JSON' }, { status: 400 });
	}
	if (!body.questions || Object.keys(body.questions).length === 0) return json({ error: 'At least one question is required' }, { status: 400 });

	try {
		return json(await runEvaluate(provider, apiKey, body, env.JEV_MODEL));
	} catch (e) {
		const err = e as Error & { statusCode?: number; body?: string };
		const status = err.statusCode === 401 || err.statusCode === 403 ? 401 : 502;
		return json({ error: err.message || String(e), detail: err.body }, { status });
	}
}

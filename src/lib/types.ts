// 和 @openrouter/sdk 的 decisions 类型对齐，只保留 playground 用到的字段
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
export type Input = string | { [key: string]: JSONValue } | JSONValue[];

export type ChoiceQuestion = { type: 'choice'; instructions: string; criteria: Record<string, string | null> };
export type ScoreQuestion = { type: 'score'; instructions: string; criteria: string[] };
export type NoulQuestion = { type: 'noul'; instructions: string; criteria?: { true: string; false: string } };
export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;

export type EvaluateRequest = { state: Input; questions: Record<string, Question> };

export type Answer =
	| { type: 'noul'; noul: number }
	| { type: 'choice'; choice: string; probabilities?: Record<string, number>; confidence?: number }
	| { type: 'score'; score: number; probabilities?: Record<string, number>; confidence?: number; legend?: Record<string, string> };

export type EvaluateResponse = {
	id?: string;
	model: string;
	provider?: string;
	answers: Record<string, Answer>;
	usage: { inputTokens: number; outputTokens: number; cost?: number };
	latencyMs: number;
};

export const MODEL_ID = 'typesafe/jev-1.13';
/** 官方标价：输入每百万 token 0.042 美元，输出免费；实际以响应里 usage.cost 为准 */
export const PRICE_PER_MTOK_INPUT = 0.042;

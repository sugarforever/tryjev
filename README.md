# tryjev

一个 Jev（TypeSafe AI 的极速决策模型）Playground：左边预设场景，中间编辑 state 和带类型的问题，右边看带概率的类型化答案。BYOK，三家服务商任选：OpenRouter（`typesafe/jev-1.13`，`alpha.decisions`）、Vercel AI Gateway（`typesafe-ai/jev`，AI SDK `experimental_evaluate`）、TypeSafe 官方 API（`jev-latest`，`POST /v1/systemone`）。

## 运行

```bash
npm install
npm run dev
```

打开 http://localhost:5173 ，点右上角的 key 按钮，选服务商、填自己的 key（BYOK）：只存在浏览器的 localStorage，每次请求放在 `x-provider` / `x-api-key` 头里转给对应服务商，服务端不保存、不记录。自己部署、不想让访客填 key 的话，按服务商设 `OPENROUTER_API_KEY` / `AI_GATEWAY_API_KEY` / `TYPESAFE_API_KEY` 做兜底（见 `.env.example`）。右上角 Swiss / Candy 切换两套外观，也可以用 `?theme=candy`。

## 结构

- `src/routes/api/evaluate/+server.ts` - 读请求头里的服务商和 key，交给 `src/lib/server/providers.ts`
- `src/lib/server/providers.ts` - 三家的适配：请求同一份 `{ state, questions }`，响应统一成 noul / choice / score + confidence + usage；Vercel 那边 noul 叫 boolean、confidence 在 providerMetadata 里，这里都转回来
- `src/lib/scenarios.ts` - 五个预设场景（一句话一个概率、工单分诊、模型路由、内容审核、给 LLM 输出把关），每个带几条可一键切换的 state
- `src/lib/types.ts` - 请求 / 响应类型（三家共用），服务商与模型 id 表
- `src/routes/+page.svelte` - 界面（Svelte 5）
- `src/app.css` / `src/theme-candy.css` - 瑞士极简默认样式 + 糖果色块主题

## 三种问题

| type | 问什么 | 答什么 |
|---|---|---|
| `noul` | 这句话为真吗（可选 `criteria: { true, false }`，要给就两个都给） | `noul`：0 到 1 的概率 |
| `choice` | 从 `criteria` 的键里选一个 | `choice` + `probabilities` + `confidence` |
| `score` | 按 `criteria` 的有序档位打分 | `score`（插值）+ `probabilities` + `confidence` |

key 的流向只有一条：浏览器 localStorage → 请求头 → 本站服务端转发 → 你选的服务商。

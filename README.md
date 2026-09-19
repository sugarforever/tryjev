# tryjev

一个 Jev（TypeSafe AI 的极速决策模型）Playground：左边预设场景，中间编辑 state 和带类型的问题，右边看带概率的类型化答案。通过 OpenRouter 的 `alpha.decisions` 接口调用 `typesafe/jev-1.13`。

## 运行

```bash
npm install
npm run dev
```

打开 http://localhost:5173 ，点右上角「Key」填自己的 OpenRouter key（BYOK）：只存在浏览器的 localStorage，每次请求放在 `x-openrouter-key` 头里转给 OpenRouter，服务端不保存、不记录。自己部署、不想让访客填 key 的话，设 `OPENROUTER_API_KEY` 环境变量做兜底（见 `.env.example`）。右上角 Swiss / Candy 切换两套外观，也可以用 `?theme=candy`。

## 结构

- `src/routes/api/evaluate/+server.ts` - 唯一的服务端代码：`openrouter.alpha.decisions.create({ decisionsRequest: { model, state, questions } })`，返回 answers / usage 和服务端耗时
- `src/lib/scenarios.ts` - 五个预设场景（一句话一个概率、工单分诊、模型路由、内容审核、给 LLM 输出把关），每个带几条可一键切换的 state
- `src/lib/types.ts` - 请求 / 响应类型，和 `@openrouter/sdk` 的 decisions 类型对齐
- `src/routes/+page.svelte` - 界面（Svelte 5）
- `src/app.css` / `src/theme-candy.css` - 瑞士极简默认样式 + 糖果色块主题

## 三种问题

| type | 问什么 | 答什么 |
|---|---|---|
| `noul` | 这句话为真吗（可选 `criteria: { true, false }`，要给就两个都给） | `noul`：0 到 1 的概率 |
| `choice` | 从 `criteria` 的键里选一个 | `choice` + `probabilities` + `confidence` |
| `score` | 按 `criteria` 的有序档位打分 | `score`（插值）+ `probabilities` + `confidence` |

key 的流向只有一条：浏览器 localStorage → 请求头 → 本站服务端转发 → OpenRouter。

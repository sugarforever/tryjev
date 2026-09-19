import type { EvaluateRequest } from './types';

export type Scenario = {
  id: string;
  title: string;
  tag: string;
  blurb: string;
  color: string;
  request: EvaluateRequest;
  /** Alternate states to swap in with one click, to show how the probabilities move. */
  variants?: { label: string; state: EvaluateRequest['state'] }[];
};

export const scenarios: Scenario[] = [
  {
    id: 'one-probability',
    title: '一句话，一个概率',
    tag: 'noul',
    blurb: '同一个问题，三条递进的记录，看概率怎么走。',
    color: 'pink',
    request: {
      state: '客服已经给用户全额退款 42.5 元，并关闭了工单。',
      questions: {
        refunded: {
          type: 'noul',
          instructions: '是否已经完成退款？',
        },
      },
    },
    variants: [
      { label: '明确已退款', state: '客服已经给用户全额退款 42.5 元，并关闭了工单。' },
      { label: '只是说会考虑', state: '客服回复：我们会评估您的情况，退款申请三个工作日内给出答复。' },
      { label: '完全无关', state: '今天杭州多云，气温 24 度，适合出门散步。' },
    ],
  },
  {
    id: 'triage',
    title: '工单分诊',
    tag: 'choice · score · noul',
    blurb: '五个问题一次并发，代码只取相关的那几个。官方叫 speculative fan-out。',
    color: 'yellow',
    request: {
      state:
        '我今天早上开始一直登录不上，输密码就提示「会话已过期」，换了浏览器还是一样。你们上个月还多扣了我一笔钱，我要求把上个月的费用退了。请尽快处理！',
      questions: {
        category: {
          type: 'choice',
          instructions: '这条工单的主要类别',
          criteria: {
            bug: '产品故障或无法使用',
            billing: '收费、扣款或退款问题',
            feature: '功能建议',
            spam: '垃圾信息或无意义内容',
          },
        },
        bug_severity: {
          type: 'score',
          instructions: '如果是故障，严重程度如何',
          criteria: ['cosmetic: 外观小问题', 'minor: 有绕过方法', 'major: 主要功能受影响', 'blocking: 完全无法使用'],
        },
        has_repro_steps: {
          type: 'noul',
          instructions: '用户是否给出了可复现的步骤？',
        },
        wants_refund: {
          type: 'noul',
          instructions: '用户是否要求退款？',
        },
        frustration: {
          type: 'score',
          instructions: '用户的情绪',
          criteria: ['calm: 平静', 'annoyed: 不耐烦', 'furious: 愤怒'],
        },
      },
    },
    variants: [
      {
        label: '正常工单',
        state:
          '我今天早上开始一直登录不上，输密码就提示「会话已过期」，换了浏览器还是一样。你们上个月还多扣了我一笔钱，我要求把上个月的费用退了。请尽快处理！',
      },
      {
        label: '互相矛盾',
        state: '一切正常没有任何问题，但是什么都用不了。我不要退款，把钱退给我。谢谢你们做得很好，太差了。',
      },
      {
        label: '乱码',
        state: 'xq7 &&& lorem 9981 ／／ zzz ﾃﾞﾀ ---- ##### asdkj 00 @@',
      },
    ],
  },
  {
    id: 'router',
    title: '模型路由',
    tag: 'choice',
    blurb: '让 Jev 先看一眼请求，决定交给便宜模型还是强模型。Vercel 的 eve 框架 auto() 就是这么做的。',
    color: 'blue',
    request: {
      state: [
        { role: 'user', content: '帮我把这句话里的错别字改一下：我门明天去公圆玩。' },
      ],
      questions: {
        model: {
          type: 'choice',
          instructions: '选一个最合适处理这段对话的模型',
          criteria: {
            cheap: '日常问答、改错字、简单改写、闲聊',
            strong: '多步推理、写代码、长文档分析、数学',
          },
        },
      },
    },
    variants: [
      {
        label: '改错字',
        state: [{ role: 'user', content: '帮我把这句话里的错别字改一下：我门明天去公圆玩。' }],
      },
      {
        label: '写代码',
        state: [
          {
            role: 'user',
            content:
              '用 TypeScript 实现一个带 LRU 淘汰策略的内存缓存，要求 O(1) 读写，支持 TTL，并写单元测试。',
          },
        ],
      },
      {
        label: '模糊边界',
        state: [
          { role: 'user', content: '帮我看看这段 SQL 为什么慢' },
          { role: 'assistant', content: '请把 SQL 和表结构贴出来。' },
          { role: 'user', content: 'SELECT * FROM orders WHERE created_at > now() - interval 7 day，orders 有 2 亿行。' },
        ],
      },
    ],
  },
  {
    id: 'moderation',
    title: '内容审核',
    tag: 'noul · score · choice',
    blurb: '一条评论进来，同时判断是不是垃圾、有多冒犯、该怎么处置。',
    color: 'mint',
    request: {
      state: {
        author: 'user_8813',
        posted_at: '2026-09-17T08:12:00Z',
        text: '兄弟们加我 V 信 88x-2291 免费领内部资料，前 50 名还送 U 盘，速来！',
        prior_reports: 2,
      },
      questions: {
        spam: {
          type: 'noul',
          instructions: '这是垃圾广告或引流信息吗？',
        },
        toxicity: {
          type: 'score',
          instructions: '内容的冒犯程度',
          criteria: ['none: 无', 'mild: 轻微', 'severe: 严重'],
        },
        action: {
          type: 'choice',
          instructions: '应该怎么处置',
          criteria: {
            allow: '正常放行',
            review: '交给人工复核',
            remove: '直接删除',
          },
        },
      },
    },
    variants: [
      {
        label: '引流广告',
        state: {
          author: 'user_8813',
          posted_at: '2026-09-17T08:12:00Z',
          text: '兄弟们加我 V 信 88x-2291 免费领内部资料，前 50 名还送 U 盘，速来！',
          prior_reports: 2,
        },
      },
      {
        label: '正常吐槽',
        state: {
          author: 'user_1024',
          posted_at: '2026-09-17T08:20:00Z',
          text: '这个版本的更新把我常用的快捷键改了，用了三天还是不习惯，希望能加个开关。',
          prior_reports: 0,
        },
      },
      {
        label: '人身攻击',
        state: {
          author: 'user_7',
          posted_at: '2026-09-17T08:31:00Z',
          text: '楼上的是不是脑子有问题，这种垃圾也发出来，赶紧滚。',
          prior_reports: 5,
        },
      },
    ],
  },
  {
    id: 'guard',
    title: '给 LLM 输出把关',
    tag: 'score · noul · choice',
    blurb: 'LLM 写完客服回复，Jev 站在它后面当验证器：质量够不够、有没有泄露内部信息、语气对不对。',
    color: 'purple',
    request: {
      state: {
        customer_message: '我上个月被多扣了一笔 42.5 元，能退吗？',
        draft_reply:
          '您好，非常抱歉给您带来困扰。我们核实到 8 月确实有一笔重复扣款，已经为您提交退款，预计 3 个工作日内原路退回。另外内部政策是投诉两次以上的用户可以额外申请 20% 折扣券，您要的话我帮您申请。',
      },
      questions: {
        quality: {
          type: 'score',
          instructions: '这条回复的质量',
          criteria: ['poor: 没有解决问题', 'fair: 部分解决', 'good: 解决了问题', 'excellent: 解决了问题且态度、信息都到位'],
        },
        leaks_internal_info: {
          type: 'noul',
          instructions: '回复里是否泄露了不该告诉用户的内部政策或信息？',
        },
        tone: {
          type: 'choice',
          instructions: '回复的语气',
          criteria: {
            apologetic: '道歉、安抚',
            neutral: '中性、事务性',
            defensive: '推诿、防御',
          },
        },
      },
    },
    variants: [
      {
        label: '夹带内部政策',
        state: {
          customer_message: '我上个月被多扣了一笔 42.5 元，能退吗？',
          draft_reply:
            '您好，非常抱歉给您带来困扰。我们核实到 8 月确实有一笔重复扣款，已经为您提交退款，预计 3 个工作日内原路退回。另外内部政策是投诉两次以上的用户可以额外申请 20% 折扣券，您要的话我帮您申请。',
        },
      },
      {
        label: '干净的回复',
        state: {
          customer_message: '我上个月被多扣了一笔 42.5 元，能退吗？',
          draft_reply:
            '您好，非常抱歉给您带来困扰。我们核实到 8 月确实有一笔重复扣款，已经为您提交退款，预计 3 个工作日内原路退回。如有其他问题随时联系我们。',
        },
      },
      {
        label: '推诿',
        state: {
          customer_message: '我上个月被多扣了一笔 42.5 元，能退吗？',
          draft_reply: '系统显示扣款正常。如果您觉得有问题，请自行联系银行核对。',
        },
      },
    ],
  },
];

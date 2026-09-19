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
    title: 'One sentence, one probability',
    tag: 'noul',
    blurb: 'Same question, three escalating notes. Watch the probability move.',
    color: 'pink',
    request: {
      state: 'Support issued a full refund of $42.50 to the customer and closed the ticket.',
      questions: {
        refunded: { type: 'noul', instructions: 'Has the refund been completed?' },
      },
    },
    variants: [
      { label: 'Clearly refunded', state: 'Support issued a full refund of $42.50 to the customer and closed the ticket.' },
      { label: 'Only a promise', state: 'Support replied: we will review your case and respond to the refund request within three business days.' },
      { label: 'Unrelated', state: 'Cloudy in Hangzhou today, 24°C, a good day for a walk.' },
    ],
  },
  {
    id: 'triage',
    title: 'Ticket triage',
    tag: 'choice · score · noul',
    blurb: 'Five questions in one call; code keeps only the relevant answers. TypeSafe calls this speculative fan-out.',
    color: 'yellow',
    request: {
      state:
        "I haven't been able to log in since this morning. Every time I enter my password it says 'session expired', and switching browsers doesn't help. You also overcharged me last month and I want that charge refunded. Please handle this ASAP!",
      questions: {
        category: {
          type: 'choice',
          instructions: 'Main category of this ticket',
          criteria: {
            bug: 'Product failure or unable to use',
            billing: 'Charges, payments or refunds',
            feature: 'Feature request',
            spam: 'Spam or meaningless content',
          },
        },
        bug_severity: {
          type: 'score',
          instructions: 'If this is a bug, how severe is it',
          criteria: ['cosmetic: minor visual issue', 'minor: has a workaround', 'major: core feature affected', 'blocking: completely unusable'],
        },
        has_repro_steps: { type: 'noul', instructions: 'Did the user provide steps to reproduce?' },
        wants_refund: { type: 'noul', instructions: 'Is the user asking for a refund?' },
        frustration: {
          type: 'score',
          instructions: "The user's mood",
          criteria: ['calm: calm', 'annoyed: impatient', 'furious: angry'],
        },
      },
    },
    variants: [
      {
        label: 'Normal ticket',
        state:
          "I haven't been able to log in since this morning. Every time I enter my password it says 'session expired', and switching browsers doesn't help. You also overcharged me last month and I want that charge refunded. Please handle this ASAP!",
      },
      {
        label: 'Contradictory',
        state: "Everything works fine but nothing works. I don't want a refund, give me my money back. Thanks, great job, terrible.",
      },
      { label: 'Garbage', state: 'xq7 &&& lorem 9981 // zzz ﾃﾞﾀ ---- ##### asdkj 00 @@' },
    ],
  },
  {
    id: 'router',
    title: 'Model routing',
    tag: 'choice',
    blurb: "Let Jev glance at the request and decide: cheap model or strong model. Vercel's eve framework does this with auto().",
    color: 'blue',
    request: {
      state: [{ role: 'user', content: "Fix the typos in this sentence: We're going too the park tomorow." }],
      questions: {
        model: {
          type: 'choice',
          instructions: 'Pick the most suitable model for this conversation',
          criteria: {
            cheap: 'Everyday Q&A, typo fixes, light rewrites, small talk',
            strong: 'Multi-step reasoning, writing code, long-document analysis, math',
          },
        },
      },
    },
    variants: [
      { label: 'Typo fix', state: [{ role: 'user', content: "Fix the typos in this sentence: We're going too the park tomorow." }] },
      {
        label: 'Write code',
        state: [{ role: 'user', content: 'Implement an in-memory LRU cache in TypeScript with O(1) reads and writes, TTL support, and unit tests.' }],
      },
      {
        label: 'Blurry line',
        state: [
          { role: 'user', content: 'Can you look at why this SQL is slow?' },
          { role: 'assistant', content: 'Please paste the SQL and the table schema.' },
          { role: 'user', content: 'SELECT * FROM orders WHERE created_at > now() - interval 7 day. The orders table has 200 million rows.' },
        ],
      },
    ],
  },
  {
    id: 'moderation',
    title: 'Content moderation',
    tag: 'noul · score · choice',
    blurb: 'One comment comes in; decide at once whether it is spam, how offensive it is, and what to do with it.',
    color: 'mint',
    request: {
      state: {
        author: 'user_8813',
        posted_at: '2026-09-17T08:12:00Z',
        text: 'Guys add me on WhatsApp 88x-2291 for free insider material, first 50 also get a USB stick, hurry!',
        prior_reports: 2,
      },
      questions: {
        spam: { type: 'noul', instructions: 'Is this spam or a solicitation?' },
        toxicity: { type: 'score', instructions: 'How offensive is the content', criteria: ['none: none', 'mild: mild', 'severe: severe'] },
        action: {
          type: 'choice',
          instructions: 'What should be done with it',
          criteria: { allow: 'Let it through', review: 'Send to a human reviewer', remove: 'Remove it' },
        },
      },
    },
    variants: [
      {
        label: 'Solicitation',
        state: {
          author: 'user_8813',
          posted_at: '2026-09-17T08:12:00Z',
          text: 'Guys add me on WhatsApp 88x-2291 for free insider material, first 50 also get a USB stick, hurry!',
          prior_reports: 2,
        },
      },
      {
        label: 'Ordinary complaint',
        state: {
          author: 'user_1024',
          posted_at: '2026-09-17T08:20:00Z',
          text: "This update changed the shortcuts I use every day. Three days in and I still can't get used to it. Please add a toggle.",
          prior_reports: 0,
        },
      },
      {
        label: 'Personal attack',
        state: {
          author: 'user_7',
          posted_at: '2026-09-17T08:31:00Z',
          text: 'Is the person above brain-dead? Posting garbage like this. Get lost.',
          prior_reports: 5,
        },
      },
    ],
  },
  {
    id: 'guard',
    title: 'Guarding LLM output',
    tag: 'score · noul · choice',
    blurb: 'An LLM drafts a support reply; Jev sits behind it as the verifier: is the quality there, did it leak internal info, is the tone right.',
    color: 'purple',
    request: {
      state: {
        customer_message: 'I was overcharged $42.50 last month. Can I get a refund?',
        draft_reply:
          "Hi, sorry for the trouble. We confirmed a duplicate charge in August and have submitted a refund; it should arrive within 3 business days. Also, our internal policy is that customers who complain twice or more can request an extra 20% discount voucher, so let me know if you'd like one.",
      },
      questions: {
        quality: {
          type: 'score',
          instructions: 'Quality of this reply',
          criteria: ['poor: does not solve the problem', 'fair: partly solves it', 'good: solves it', 'excellent: solves it with the right tone and complete information'],
        },
        leaks_internal_info: { type: 'noul', instructions: 'Does the reply leak internal policy or information the customer should not see?' },
        tone: {
          type: 'choice',
          instructions: 'Tone of the reply',
          criteria: { apologetic: 'Apologetic, reassuring', neutral: 'Neutral, matter-of-fact', defensive: 'Deflecting, defensive' },
        },
      },
    },
    variants: [
      {
        label: 'Leaks a policy',
        state: {
          customer_message: 'I was overcharged $42.50 last month. Can I get a refund?',
          draft_reply:
            "Hi, sorry for the trouble. We confirmed a duplicate charge in August and have submitted a refund; it should arrive within 3 business days. Also, our internal policy is that customers who complain twice or more can request an extra 20% discount voucher, so let me know if you'd like one.",
        },
      },
      {
        label: 'Clean reply',
        state: {
          customer_message: 'I was overcharged $42.50 last month. Can I get a refund?',
          draft_reply:
            'Hi, sorry for the trouble. We confirmed a duplicate charge in August and have submitted a refund; it should arrive within 3 business days. Let us know if there is anything else.',
        },
      },
      {
        label: 'Deflecting',
        state: {
          customer_message: 'I was overcharged $42.50 last month. Can I get a refund?',
          draft_reply: 'Our system shows the charge was correct. If you think something is wrong, please contact your bank.',
        },
      },
    ],
  },
];

// ============================================================================
// AI Hotspot — seed data
// Realistic AI news items (April 2026 timeframe) with Chinese summaries,
// cluster relationships, hotness scores, and Claude-voiced 推荐理由.
// ============================================================================

const SOURCES = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Blog',
    kind: 'official',
    color: '#D4911C',
    initial: 'A',
    url: 'anthropic.com',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI Blog',
    kind: 'official',
    color: '#0A7A5F',
    initial: 'O',
    url: 'openai.com',
  },
  deepmind: {
    id: 'deepmind',
    name: 'Google DeepMind',
    kind: 'official',
    color: '#2558B5',
    initial: 'G',
    url: 'deepmind.google',
  },
  meta: {
    id: 'meta',
    name: 'Meta AI',
    kind: 'official',
    color: '#1C4FD8',
    initial: 'M',
    url: 'ai.meta.com',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    kind: 'official',
    color: '#E4572E',
    initial: 'M',
    url: 'mistral.ai',
  },
  xai: { id: 'xai', name: 'xAI', kind: 'official', color: '#0B0B0C', initial: 'x', url: 'x.ai' },
  hn: {
    id: 'hn',
    name: 'Hacker News',
    kind: 'forum',
    color: '#FF6600',
    initial: 'Y',
    url: 'news.ycombinator.com',
  },
  reddit_ml: {
    id: 'reddit_ml',
    name: 'r/MachineLearning',
    kind: 'forum',
    color: '#FF4500',
    initial: 'r',
    url: 'reddit.com/r/ML',
  },
  reddit_local: {
    id: 'reddit_local',
    name: 'r/LocalLLaMA',
    kind: 'forum',
    color: '#FF4500',
    initial: 'r',
    url: 'reddit.com/r/LocalLLaMA',
  },
  twitter: {
    id: 'twitter',
    name: 'X / Twitter',
    kind: 'social',
    color: '#0B0B0C',
    initial: '𝕏',
    url: 'x.com',
  },
  github: {
    id: 'github',
    name: 'GitHub Trending',
    kind: 'code',
    color: '#24292F',
    initial: 'G',
    url: 'github.com',
  },
  arxiv: {
    id: 'arxiv',
    name: 'arXiv',
    kind: 'paper',
    color: '#B3261E',
    initial: 'χ',
    url: 'arxiv.org',
  },
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    kind: 'code',
    color: '#FFB400',
    initial: '🤗',
    url: 'huggingface.co',
  },
  machine_heart: {
    id: 'machine_heart',
    name: '机器之心',
    kind: 'wechat',
    color: '#E4572E',
    initial: '心',
    url: 'jiqizhixin.com',
  },
  qbit: {
    id: 'qbit',
    name: '量子位',
    kind: 'wechat',
    color: '#2558B5',
    initial: '量',
    url: 'qbitai.com',
  },
  ai_front: {
    id: 'ai_front',
    name: 'AI 前线',
    kind: 'wechat',
    color: '#0A7A5F',
    initial: '前',
    url: 'infoq.cn',
  },
  xinzhiyuan: {
    id: 'xinzhiyuan',
    name: '新智元',
    kind: 'wechat',
    color: '#8F5D0A',
    initial: '元',
    url: 'aiera.com.cn',
  },
  weibo: {
    id: 'weibo',
    name: '微博',
    kind: 'social',
    color: '#E4572E',
    initial: '微',
    url: 'weibo.com',
  },
  buzzing: {
    id: 'buzzing',
    name: 'Buzzing.cc',
    kind: 'forum',
    color: '#0B0B0C',
    initial: 'B',
    url: 'buzzing.cc',
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 AI',
    kind: 'official',
    color: '#2558B5',
    initial: '智',
    url: 'zhipu.ai',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'official',
    color: '#1C4FD8',
    initial: 'D',
    url: 'deepseek.com',
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot AI',
    kind: 'official',
    color: '#0B0B0C',
    initial: '月',
    url: 'moonshot.cn',
  },
};

// Tag taxonomy — per spec: Agent, 模型发布, 编码, Anthropic, etc.
const TAGS = {
  release: { label: '模型发布', tone: 'accent' },
  agent: { label: 'Agent', tone: 'neutral' },
  coding: { label: '编码', tone: 'neutral' },
  research: { label: '研究', tone: 'neutral' },
  opensrc: { label: '开源', tone: 'success' },
  multimodal: { label: '多模态', tone: 'neutral' },
  eval: { label: '评测', tone: 'neutral' },
  infra: { label: '基建', tone: 'neutral' },
  funding: { label: '融资', tone: 'info' },
  policy: { label: '监管', tone: 'danger' },
  anthropic: { label: 'Anthropic', tone: 'neutral' },
  openai: { label: 'OpenAI', tone: 'neutral' },
  google: { label: 'Google', tone: 'neutral' },
  meta: { label: 'Meta', tone: 'neutral' },
  deepseek: { label: 'DeepSeek', tone: 'neutral' },
  robotics: { label: '具身智能', tone: 'neutral' },
  chip: { label: '芯片', tone: 'neutral' },
  product: { label: '产品', tone: 'neutral' },
};

// Timeline items. Time is a human-readable Chinese stamp + iso for sort.
// `cluster` links items that cover the same event — the one with highest score
// becomes the primary, and siblings collapse into "另有 N 个源也报道了此事件".
const ITEMS = [
  // ============ CLUSTER 1: Claude 4.5 Sonnet release (huge) ============
  {
    id: 'claude-45-anthropic',
    cluster: 'claude-45',
    source: 'anthropic',
    title: 'Claude Sonnet 4.5 发布:编码能力再度飞跃,Agent 任务延长至 40 小时',
    summary:
      'Anthropic 发布 Claude Sonnet 4.5,在 SWE-bench Verified 上达到 82.3%,首次超越其自家 Opus 系列。新版本在多步骤 Agent 任务上的持续时间从 24 小时延长至 40 小时,价格与前代持平($3/$15 每百万 token)。官方重点展示了长时间运行的代码重构与跨仓库迁移用例。',
    reason:
      '这是 2026 年至今最重要的一次基础模型更新。"编码 Agent 持续 40 小时"是一个真实产品层面的拐点,意味着隔夜批处理式的开发工作流开始可行。',
    tags: ['release', 'anthropic', 'coding', 'agent'],
    score: 96,
    time: '14:28',
    iso: '2026-04-20T14:28',
    url: '#',
  },
  {
    id: 'claude-45-hn',
    cluster: 'claude-45',
    source: 'hn',
    title: 'Claude Sonnet 4.5 released — 82.3% on SWE-bench Verified',
    summary:
      'HN 热度登顶,评论主要关注 40 小时 Agent 任务的真实可复现性,以及与 GPT-5.1-Codex 的横向对比。也有工程师晒出自己用新版重构 40k 行遗留代码库的全程日志。',
    reason: null, // secondary in cluster
    tags: ['release', 'anthropic', 'coding'],
    score: 89,
    time: '15:02',
    iso: '2026-04-20T15:02',
    url: '#',
  },
  {
    id: 'claude-45-qbit',
    cluster: 'claude-45',
    source: 'qbit',
    title: '深夜突袭!Claude 4.5 Sonnet 降临,编码榜再刷新',
    summary:
      '量子位独家解读:新模型在 Anthropic 内部代号 "Lucid",训练计算量据传较 4.0 Sonnet 翻倍,但推理成本未变。文章还整理了国内开发者首批实测对比。',
    reason: null,
    tags: ['release', 'anthropic', 'coding'],
    score: 78,
    time: '16:10',
    iso: '2026-04-20T16:10',
    url: '#',
  },
  {
    id: 'claude-45-twitter',
    cluster: 'claude-45',
    source: 'twitter',
    title:
      '@AnthropicAI: Introducing Claude Sonnet 4.5 — our best coding model, and Agent runs now sustain 40 hours.',
    summary:
      'Anthropic 官方推文在 2 小时内转发突破 1.8 万,评论区以开发者实测截图为主。Dario Amodei 本人转发了一条展示模型连续修复 14 个生产 bug 的演示视频。',
    reason: null,
    tags: ['release', 'anthropic'],
    score: 71,
    time: '14:34',
    iso: '2026-04-20T14:34',
    url: '#',
  },
  {
    id: 'claude-45-machineheart',
    cluster: 'claude-45',
    source: 'machine_heart',
    title: 'Anthropic 再出王炸:Claude 4.5 Sonnet 在 SWE-bench 追平 Opus',
    summary:
      '机器之心长文分析:中杯模型达到大杯性能,Anthropic 的定价策略与 API 容量规划可能因此改写,对国内云厂商 API 转售业务构成直接压力。',
    reason: null,
    tags: ['release', 'anthropic'],
    score: 74,
    time: '17:44',
    iso: '2026-04-20T17:44',
    url: '#',
  },

  // ============ CLUSTER 2: DeepSeek V4 ============
  {
    id: 'deepseek-v4',
    cluster: 'deepseek-v4',
    source: 'deepseek',
    title: 'DeepSeek-V4 开源发布,685B MoE 架构,权重完整放出',
    summary:
      'DeepSeek 发布 V4,采用 685B 参数 MoE 架构(激活 37B),MIT 协议开源完整权重与训练配方。在 MMLU-Pro 与 GPQA 上逼近 Claude Sonnet 4.5,推理成本仅为后者 1/8。HuggingFace 上线首日下载破 12 万。',
    reason:
      '开源最前沿依然来自中国实验室。V4 把"高端闭源模型的可替代性"又向前推进了一大步,对自托管与内网部署场景是实质利好。',
    tags: ['release', 'deepseek', 'opensrc', 'research'],
    score: 93,
    time: '11:15',
    iso: '2026-04-20T11:15',
    url: '#',
  },
  {
    id: 'deepseek-v4-hf',
    cluster: 'deepseek-v4',
    source: 'huggingface',
    title: 'deepseek-ai/DeepSeek-V4 — trending #1',
    summary:
      'HuggingFace 24 小时下载量 121k,点赞 3.2k,目前稳居 Trending 榜首。社区已有 Q4_K_M、AWQ-4bit 等多种量化版本。',
    reason: null,
    tags: ['release', 'deepseek', 'opensrc'],
    score: 82,
    time: '13:40',
    iso: '2026-04-20T13:40',
    url: '#',
  },
  {
    id: 'deepseek-v4-reddit',
    cluster: 'deepseek-v4',
    source: 'reddit_local',
    title: 'DeepSeek V4 on 2×H100 — first impressions',
    summary:
      'r/LocalLLaMA 热帖:一位用户使用 2×H100 80GB 成功以 Q4 运行 V4,每秒 18 token,吞吐令社区震惊。评论正在整理最小可行硬件配置清单。',
    reason: null,
    tags: ['deepseek', 'opensrc', 'infra'],
    score: 76,
    time: '18:22',
    iso: '2026-04-20T18:22',
    url: '#',
  },
  {
    id: 'deepseek-v4-xinzhiyuan',
    cluster: 'deepseek-v4',
    source: 'xinzhiyuan',
    title: 'DeepSeek V4 开源:不只是性价比,而是重写规则',
    summary:
      '新智元深度解读训练栈:DSPv4 的 MLA 注意力改进与 FP8 混精训练让 685B 模型在 2.8k H800 上训练仅需 40 天。',
    reason: null,
    tags: ['deepseek', 'research'],
    score: 77,
    time: '15:50',
    iso: '2026-04-20T15:50',
    url: '#',
  },

  // ============ CLUSTER 3: OpenAI Operator GA ============
  {
    id: 'openai-operator',
    cluster: 'openai-operator',
    source: 'openai',
    title: 'OpenAI Operator 全面开放,Plus 用户免费使用',
    summary:
      'OpenAI 今日宣布 Operator 浏览器 Agent 正式 GA,Plus 订阅($20/月)用户可直接使用,企业版并发上限提升至 50。支持跨网页表单填写、比价、订票、文档采集四大类任务,并新增"Session Replay"用于审查 Agent 每一步操作。',
    reason:
      'Agent 类产品正在从 demo 过渡到日常工具。Operator 免费放进 Plus 是一次大规模真实用户压力测试,值得持续观察完成率与错误模式。',
    tags: ['openai', 'agent', 'product'],
    score: 88,
    time: '09:00',
    iso: '2026-04-20T09:00',
    url: '#',
  },
  {
    id: 'openai-operator-qbit',
    cluster: 'openai-operator',
    source: 'qbit',
    title: 'OpenAI Operator 正式上线,实测订机票 11 分钟',
    summary:
      '量子位实测:让 Operator 完成"上海飞东京 4 月末往返、经济舱、中转不超 1 次"的订票任务,共用时 11 分 03 秒,中途因信用卡 3DS 验证请求人工介入 1 次。',
    reason: null,
    tags: ['openai', 'agent'],
    score: 72,
    time: '10:30',
    iso: '2026-04-20T10:30',
    url: '#',
  },
  {
    id: 'openai-operator-hn',
    cluster: 'openai-operator',
    source: 'hn',
    title: 'Operator is now free for ChatGPT Plus',
    summary:
      'HN 置顶讨论中心话题:对真实世界 action 的审计、prompt injection 缓解、以及 Operator 在金融/医疗场景的合规边界。',
    reason: null,
    tags: ['openai', 'agent', 'policy'],
    score: 70,
    time: '12:18',
    iso: '2026-04-20T12:18',
    url: '#',
  },

  // ============ CLUSTER 4: Gemini 3 Pro ============
  {
    id: 'gemini-3',
    cluster: 'gemini-3',
    source: 'deepmind',
    title: 'Gemini 3 Pro 登场,原生多模态上下文 10M tokens',
    summary:
      'Google DeepMind 发布 Gemini 3 Pro,将原生多模态上下文扩展至 10M tokens,在视频理解基准 VideoMME 上达到 79.4%。开发者套件同步上线 Veo-3 视频生成与 Imagen-4。',
    reason:
      '10M 上下文听起来像一次工程宣告,更值得关注的是其在长视频与代码库整体理解上的真实可用性。竞争从"模型能力"转向"上下文工程"。',
    tags: ['release', 'google', 'multimodal'],
    score: 87,
    time: '03:15',
    iso: '2026-04-20T03:15',
    url: '#',
  },
  {
    id: 'gemini-3-ml',
    cluster: 'gemini-3',
    source: 'reddit_ml',
    title: 'Gemini 3 Pro on VideoMME — 79.4%, what changed?',
    summary:
      '讨论聚焦 Gemini 3 的视频编码器变化:疑似采用新的时序 token 压缩方案,将 1 小时视频压到约 48k token,较前代密度提高 3.2×。',
    reason: null,
    tags: ['google', 'multimodal', 'research'],
    score: 68,
    time: '07:42',
    iso: '2026-04-20T07:42',
    url: '#',
  },

  // ============ STANDALONE: Meta Llama 4.5 rumor ============
  {
    id: 'llama-45-rumor',
    cluster: null,
    source: 'buzzing',
    title: '传闻:Meta Llama 4.5 将于 5 月 LlamaCon 发布,首次开放视频生成权重',
    summary:
      'Buzzing.cc 汇总多位匿名员工爆料:Llama 4.5 将包含 8B、70B、405B 三档,并首次配套开源"Movie Gen"视频生成模型的完整权重。Meta 官方暂未回应。',
    reason:
      '若属实,将是开源阵营首次获得可商用的视频生成前沿权重。不过信源为聚合爆料,建议等待 LlamaCon 5/18 官方确认。',
    tags: ['meta', 'release', 'opensrc', 'multimodal'],
    score: 73,
    time: '13:05',
    iso: '2026-04-20T13:05',
    url: '#',
  },

  // ============ STANDALONE: Anthropic Constitutional AI paper ============
  {
    id: 'ai-paper-cai2',
    cluster: null,
    source: 'arxiv',
    title: 'Scaling Constitutional AI to Open-Ended Agentic Tasks (Anthropic, 2026)',
    summary:
      'Anthropic 新论文提出 CAI-2 框架,将 Constitutional AI 扩展到长程 Agent 任务:以自然语言规则约束模型在 50+ 步工具使用中的行为。在三类 Agent 基准上把有害/越权操作降低 67%。',
    reason:
      '可解读性 + 可治理性是 Agent 普及绕不过的坎。这篇为"用自然语言写 Agent 的 guardrail"提供了可规模化的方法,对企业部署有直接参考价值。',
    tags: ['anthropic', 'research', 'agent', 'policy'],
    score: 81,
    time: '08:30',
    iso: '2026-04-20T08:30',
    url: '#',
  },

  // ============ STANDALONE: Zhipu funding ============
  {
    id: 'zhipu-funding',
    cluster: null,
    source: 'xinzhiyuan',
    title: '智谱 AI 完成 40 亿元新一轮融资,国资领投',
    summary:
      '智谱宣布完成新一轮 40 亿元人民币融资,中关村科学城、北京 AI 产业基金等国资领投。官方表示资金将主要用于 GLM-5 训练集群建设与 Agent 产品矩阵扩展。',
    reason:
      '国内基础模型层继续由国资主导,资本节奏与政策节奏高度绑定。值得关注智谱后续在 B 端 Agent 产品线的落地速度。',
    tags: ['funding', 'research'],
    score: 66,
    time: '10:50',
    iso: '2026-04-20T10:50',
    url: '#',
  },

  // ============ STANDALONE: EU AI Act update ============
  {
    id: 'eu-ai-act',
    cluster: null,
    source: 'buzzing',
    title: '欧盟 AI Act 第二阶段实施细则发布,GPAI 合规窗口剩 60 天',
    summary:
      '欧盟委员会今日公布 AI Act 第二阶段实施细则,通用目的 AI(GPAI)模型提供商需在 60 天内提交训练数据摘要与版权合规声明。未合规产品将被禁止在欧盟 27 国提供服务。',
    reason:
      '对 Anthropic、OpenAI、Google、Meta、Mistral 均为硬门槛。国内开源模型如 DeepSeek、GLM 若未完成合规登记,欧洲开发者调用路径会中断。',
    tags: ['policy'],
    score: 79,
    time: '06:20',
    iso: '2026-04-20T06:20',
    url: '#',
  },

  // ============ STANDALONE: xAI Grok 4 ============
  {
    id: 'grok-4',
    cluster: null,
    source: 'xai',
    title: 'xAI 发布 Grok 4,首次进入编码前三',
    summary:
      'xAI 发布 Grok 4,在 SWE-bench Verified 上 71.2%,首次与 Claude、GPT 进入同一梯队。API 定价 $5/$25 每百万 token,集成 X 实时数据作为默认工具。',
    reason:
      '定价略高于 Sonnet 4.5 且能力未领先,短期内对开发者吸引力有限;X 实时数据集成在新闻类 Agent 场景可能成为差异化。',
    tags: ['release', 'coding'],
    score: 64,
    time: '05:10',
    iso: '2026-04-20T05:10',
    url: '#',
  },

  // ============ STANDALONE: Mistral enterprise ============
  {
    id: 'mistral-enterprise',
    cluster: null,
    source: 'mistral',
    title: 'Mistral Large 3 企业私有化部署方案上线',
    summary:
      'Mistral 推出 Large 3 的本地化企业部署方案,支持 vLLM/TGI 两种推理栈,最小硬件需求 4×H100,提供 24 个月安全更新与 SOC 2 合规文档。',
    reason:
      '欧洲大企业 AI 落地依然偏好私有化方案。Mistral 在"可审计 + 本地部署"这条路线的持续投入,填补了 Llama + Claude 之间的中间地带。',
    tags: ['release', 'infra', 'product'],
    score: 62,
    time: '04:00',
    iso: '2026-04-20T04:00',
    url: '#',
  },

  // ============ STANDALONE: GitHub trending agent ============
  {
    id: 'github-browserbase',
    cluster: null,
    source: 'github',
    title: 'browserbase/stagehand 单日 star +4.2k,进入 Trending 榜首',
    summary:
      'Stagehand 是一个面向 AI Agent 的浏览器自动化 SDK,今日因与 Claude Sonnet 4.5 协同演示爆火,24 小时新增 star 4,200,总 star 突破 1.8 万。作者公开承诺 MIT 永久开源。',
    reason:
      '值得关注的 Agent 基建项目。相较 Playwright,Stagehand 的 API 为 LLM 设计,使用 observe/act/extract 三元动作抽象,显著降低 Agent 接入成本。',
    tags: ['opensrc', 'agent', 'infra'],
    score: 70,
    time: '19:15',
    iso: '2026-04-20T19:15',
    url: '#',
  },

  // ============ STANDALONE: Moonshot Kimi ============
  {
    id: 'kimi-k2',
    cluster: null,
    source: 'moonshot',
    title: 'Moonshot 发布 Kimi K2,长文本场景刷新 SOTA',
    summary:
      'Moonshot 发布 Kimi K2,原生 2M 上下文,在 Ruler(4k-2M)长文本压力测试上获得 92.4%,为目前公开模型最好成绩。免费版用户可直接使用。',
    reason:
      '国内长上下文路线的持续领跑。Kimi 的免费策略给开发者一个零成本试水 2M 上下文场景的入口,可作为 Gemini 3 的国内替代参考。',
    tags: ['release', 'product'],
    score: 75,
    time: '17:05',
    iso: '2026-04-20T17:05',
    url: '#',
  },

  // ============ STANDALONE: Robotics ============
  {
    id: 'figure-02',
    cluster: null,
    source: 'twitter',
    title: 'Figure 宣布与宝马二期合作:人形机器人进入两条焊装产线',
    summary:
      'Figure AI 在 X 发布视频:Figure 02 已在宝马 Spartanburg 工厂两条焊装产线正式上岗,连续 200 小时无人监管运行。视频展示其完成 14 类复杂装配动作。',
    reason:
      '人形机器人从 demo 进入规模化产线的实例还不多。Figure 与宝马的合作节奏值得和特斯拉 Optimus 横向对标跟踪。',
    tags: ['robotics', 'product'],
    score: 69,
    time: '20:40',
    iso: '2026-04-20T20:40',
    url: '#',
  },

  // ============ Yesterday ============
  {
    id: 'nvidia-rubin',
    cluster: null,
    source: 'weibo',
    title: 'Nvidia Rubin 架构细节首次泄露:HBM4 + 2TB/s 互联',
    summary:
      '微博数码博主 @老黄的厨房 贴出一张疑似 Rubin Ultra 模组照片,288GB HBM4 与 NVLink 6 配置属实。Nvidia 暂未置评。',
    reason:
      '传闻阶段,真伪未知。若属实,Rubin 的内存带宽将对当前 MoE 训练栈的"带宽墙"构成直接解法,2026Q4 的训练节奏可能被打乱。',
    tags: ['chip', 'infra'],
    score: 58,
    time: '23:20',
    iso: '2026-04-19T23:20',
    url: '#',
  },
  {
    id: 'anthropic-mcp-2',
    cluster: null,
    source: 'anthropic',
    title: 'Model Context Protocol 2.0 规范发布',
    summary:
      'Anthropic 牵头的 MCP 2.0 规范今日发布,新增 streaming tools、resource subscriptions、sampler-side caching 三大能力。已有 140+ IDE/工具宣布支持。',
    reason:
      'MCP 正在成为 Agent 与工具之间的事实标准。2.0 的 streaming 与 caching 直接解决了目前长程 Agent 的响应体验与成本问题。',
    tags: ['anthropic', 'agent', 'infra', 'opensrc'],
    score: 84,
    time: '22:00',
    iso: '2026-04-19T22:00',
    url: '#',
  },
  {
    id: 'hn-gpu-poor',
    cluster: null,
    source: 'hn',
    title: 'Show HN: I trained a 3B model on a single 4090 in 72 hours',
    summary:
      '一位开发者展示了用单张 4090 + FlashAttention-3 + muon 优化器 + 高质量数据 1B token 训练 3B 参数模型的完整过程。在多项基准上接近 TinyLlama 7B。',
    reason:
      '硬件平民化的一小步。虽然结果并非 SOTA,但"一人一卡三天一个可用小模型"的工程路径对教学和实验极具价值。',
    tags: ['opensrc', 'research'],
    score: 67,
    time: '21:15',
    iso: '2026-04-19T21:15',
    url: '#',
  },

  // ============ 2 days ago ============
  {
    id: 'openai-realtime',
    cluster: null,
    source: 'openai',
    title: 'OpenAI Realtime API 价格下调 60%,新增视频输入',
    summary:
      'OpenAI 宣布 Realtime API 输入价格从 $5/M 降至 $2/M,输出从 $20/M 降至 $8/M,并首次支持视频流输入(beta)。',
    reason:
      '实时语音/视频的成本曲线在持续下降,推动"AI 电话"类产品进入可行区间。国内可对比阿里 Qwen-Omni、智谱 GLM-Realtime 的定价更新节奏。',
    tags: ['openai', 'multimodal', 'product'],
    score: 72,
    time: '15:30',
    iso: '2026-04-18T15:30',
    url: '#',
  },
  {
    id: 'alignment-redteam',
    cluster: null,
    source: 'arxiv',
    title: 'Automated Red-Teaming of Frontier Agents at Scale',
    summary:
      'DeepMind 与 UK AISI 联合论文,介绍一个可以自动发现 Agent 越权行为的系统:在 Claude、GPT、Gemini 三家 Agent 上触发了 1,200+ 真实安全问题。',
    reason:
      'Agent 安全评测终于走向工业化。AISI 的方法论细节写得非常实在,值得企业内部安全团队复现落地。',
    tags: ['research', 'policy', 'agent'],
    score: 71,
    time: '11:00',
    iso: '2026-04-18T11:00',
    url: '#',
  },
];

// Collapse cluster metadata into primary items
const buildFeed = (items) => {
  const byCluster = {};
  items.forEach((it) => {
    if (!it.cluster) return;
    (byCluster[it.cluster] = byCluster[it.cluster] || []).push(it);
  });
  Object.values(byCluster).forEach((group) => {
    group.sort((a, b) => b.score - a.score);
  });
  // Mark primary vs siblings
  items.forEach((it) => {
    if (!it.cluster) {
      it._primary = true;
      return;
    }
    const group = byCluster[it.cluster];
    it._primary = group[0].id === it.id;
    it._cluster_siblings = group.filter((g) => g.id !== it.id);
    it._cluster_size = group.length;
  });
  return items;
};

const FEED = buildFeed(ITEMS);

// Admin data
const STRATEGIES = [
  {
    id: 's1',
    name: '模型发布优先',
    desc: '当一条内容涉及"模型发布"或"release"时,热度加权 1.5×',
    enabled: true,
    weight: 1.5,
    triggers: 142,
  },
  {
    id: 's2',
    name: '降低营销稿权重',
    desc: '公众号来源中命中"震惊|重磅|炸裂"的标题,热度 ×0.6',
    enabled: true,
    weight: 0.6,
    triggers: 38,
  },
  {
    id: 's3',
    name: 'Anthropic 加权',
    desc: 'Anthropic 官方渠道所有内容热度 +5',
    enabled: true,
    weight: 1.0,
    triggers: 26,
  },
  {
    id: 's4',
    name: '论文优先级提升',
    desc: 'arXiv cs.CL / cs.AI 论文热度加权 1.3×',
    enabled: true,
    weight: 1.3,
    triggers: 94,
  },
  {
    id: 's5',
    name: '去重窗口 48h',
    desc: '聚类时间窗口设为 48 小时',
    enabled: true,
    weight: 1.0,
    triggers: null,
  },
  {
    id: 's6',
    name: '政策类高亮',
    desc: '欧盟/美国/中国 AI 监管类内容必进精选',
    enabled: false,
    weight: 2.0,
    triggers: 12,
  },
];

const USERS = [
  {
    id: 'u1',
    email: 'chen.li@example.cn',
    role: '管理员',
    joined: '2025-11-12',
    status: '正常',
    favorites: 312,
    likes: 1840,
  },
  {
    id: 'u2',
    email: 'wang.yi@example.com',
    role: '用户',
    joined: '2026-01-03',
    status: '正常',
    favorites: 87,
    likes: 421,
  },
  {
    id: 'u3',
    email: 'liu.m@example.cn',
    role: '用户',
    joined: '2026-02-18',
    status: '正常',
    favorites: 22,
    likes: 98,
  },
  {
    id: 'u4',
    email: 'dev@startup.io',
    role: '用户',
    joined: '2026-03-05',
    status: '正常',
    favorites: 156,
    likes: 603,
  },
  {
    id: 'u5',
    email: 'noreply+spam@qq.com',
    role: '用户',
    joined: '2026-04-11',
    status: '封禁',
    favorites: 0,
    likes: 4,
  },
  {
    id: 'u6',
    email: 'zhou.h@bigco.com',
    role: '运营',
    joined: '2025-12-20',
    status: '正常',
    favorites: 78,
    likes: 312,
  },
  {
    id: 'u7',
    email: 'ai-watcher@newsletter.cn',
    role: '用户',
    joined: '2026-03-29',
    status: '正常',
    favorites: 488,
    likes: 2104,
  },
  {
    id: 'u8',
    email: 'yamada@jp.ai',
    role: '用户',
    joined: '2026-04-02',
    status: '正常',
    favorites: 31,
    likes: 112,
  },
];

const SOURCES_LIST = [
  {
    id: 'src-anthropic',
    name: 'Anthropic Blog',
    route: 'anthropic.com/news',
    weight: 1.4,
    health: 'ok',
    items24h: 2,
  },
  {
    id: 'src-openai',
    name: 'OpenAI Blog',
    route: 'openai.com/blog/rss.xml',
    weight: 1.4,
    health: 'ok',
    items24h: 3,
  },
  {
    id: 'src-deepmind',
    name: 'Google DeepMind',
    route: 'deepmind.google/blog/rss',
    weight: 1.3,
    health: 'ok',
    items24h: 1,
  },
  {
    id: 'src-arxiv-cl',
    name: 'arXiv cs.CL',
    route: 'rsshub:/arxiv/list/cs.CL',
    weight: 1.2,
    health: 'ok',
    items24h: 38,
  },
  {
    id: 'src-arxiv-ai',
    name: 'arXiv cs.AI',
    route: 'rsshub:/arxiv/list/cs.AI',
    weight: 1.2,
    health: 'ok',
    items24h: 46,
  },
  {
    id: 'src-hn',
    name: 'Hacker News (AI)',
    route: 'rsshub:/hackernews/keywords/ai',
    weight: 1.1,
    health: 'ok',
    items24h: 84,
  },
  {
    id: 'src-reddit-ml',
    name: 'r/MachineLearning',
    route: 'rsshub:/reddit/subreddit/MachineLearning',
    weight: 1.0,
    health: 'ok',
    items24h: 22,
  },
  {
    id: 'src-reddit-llm',
    name: 'r/LocalLLaMA',
    route: 'rsshub:/reddit/subreddit/LocalLLaMA',
    weight: 1.0,
    health: 'ok',
    items24h: 41,
  },
  {
    id: 'src-twitter-ant',
    name: '@AnthropicAI',
    route: 'rsshub:/twitter/user/AnthropicAI',
    weight: 1.2,
    health: 'degraded',
    items24h: 0,
  },
  {
    id: 'src-twitter-oai',
    name: '@OpenAI',
    route: 'rsshub:/twitter/user/OpenAI',
    weight: 1.2,
    health: 'ok',
    items24h: 4,
  },
  {
    id: 'src-qbit',
    name: '量子位',
    route: 'rsshub:/wechat/ownth/qbitai',
    weight: 1.0,
    health: 'ok',
    items24h: 11,
  },
  {
    id: 'src-machine',
    name: '机器之心',
    route: 'rsshub:/wechat/ownth/jiqizhixin',
    weight: 1.0,
    health: 'ok',
    items24h: 8,
  },
  {
    id: 'src-xinzhi',
    name: '新智元',
    route: 'rsshub:/wechat/ownth/aiera',
    weight: 1.0,
    health: 'ok',
    items24h: 9,
  },
  {
    id: 'src-weibo-ai',
    name: '微博 AI 话题',
    route: 'rsshub:/weibo/tag/%E4%BA%BAE5%B7%A5%E6%99%BA%E8%83%BD',
    weight: 0.8,
    health: 'ok',
    items24h: 56,
  },
  {
    id: 'src-github',
    name: 'GitHub Trending (AI)',
    route: 'rsshub:/github/trending/daily/python',
    weight: 1.0,
    health: 'ok',
    items24h: 25,
  },
  {
    id: 'src-hf',
    name: 'Hugging Face models',
    route: 'rsshub:/huggingface/daily',
    weight: 1.0,
    health: 'ok',
    items24h: 18,
  },
  {
    id: 'src-buzzing',
    name: 'Buzzing.cc',
    route: 'buzzing.cc/feed',
    weight: 0.9,
    health: 'error',
    items24h: 0,
  },
  {
    id: 'src-zhipu',
    name: '智谱 AI 官方',
    route: 'rsshub:/zhipu/news',
    weight: 1.1,
    health: 'ok',
    items24h: 1,
  },
  {
    id: 'src-deepseek',
    name: 'DeepSeek',
    route: 'deepseek.com/news/rss.xml',
    weight: 1.2,
    health: 'ok',
    items24h: 2,
  },
];

Object.assign(window, { SOURCES, TAGS, ITEMS, FEED, STRATEGIES, USERS, SOURCES_LIST });

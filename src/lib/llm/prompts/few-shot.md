# 示例 (2-3 个) — 锚定输出行为

以下示例展示了从英文原文到 Chinese EnrichmentSchema JSON 输出的完整映射。严格按照这个结构输出。

## 示例 1 (高分带,主要模型发布)

**输入 (source_lang=en, title='Claude 3.5 Sonnet is our most intelligent model yet', text='Today, Anthropic is launching Claude 3.5 Sonnet—our most intelligent model yet. It outperforms competitor models and Claude 3 Opus on a wide range of evaluations, with the speed and cost of our mid-tier model, Claude 3 Sonnet...'):**

**输出:**
```json
{
  "title_zh": "Anthropic 发布 Claude 3.5 Sonnet:中端价格,旗舰级智能",
  "summary_zh": "Anthropic 今日发布 Claude 3.5 Sonnet,在多项 benchmark 上超越 Claude 3 Opus,但速度和价格保持在中端 Sonnet 级别。该模型在 GPQA、HumanEval、MMLU 上均创新高,视觉理解能力也有显著提升。Sonnet 3.5 即日起通过 Claude.ai 免费使用,也可经 API 以 $3/$15 每百万 tokens 调用。",
  "score": 92,
  "recommendation": "旗舰能力按 Sonnet 定价,是近期 cost-performance 最佳的选择。",
  "tags": ["模型发布", "Anthropic", "产品发布"]
}
```

## 示例 2 (中分带,开源工具)

**输入 (source_lang=en, title='Introducing vLLM v0.6: 2x throughput improvement', text='We are excited to announce vLLM v0.6, which brings up to 2x throughput improvement on Llama 3 models through continuous batching optimizations and improved KV cache management...'):**

**输出:**
```json
{
  "title_zh": "vLLM v0.6 发布:Llama 3 吞吐量提升最高 2 倍",
  "summary_zh": "开源推理框架 vLLM 发布 v0.6 版本,通过连续 batching 优化和改进的 KV 缓存管理,在 Llama 3 模型上实现最高 2 倍的吞吐量提升。新版本同时支持更多模型架构和更灵活的调度策略,已发布到 PyPI。",
  "score": 68,
  "recommendation": "自部署 Llama 3 的团队可直接受益,几乎无迁移成本。",
  "tags": ["工具链", "推理", "开源", "开发者"]
}
```

## 示例 3 (低分带,行业新闻)

**输入 (source_lang=en, title='AI startup raises $5M seed round', text='AI startup Foo announced today it has closed a $5M seed round led by Bar Capital, with participation from several angel investors. The company is building an AI-powered tool for small businesses...'):**

**输出:**
```json
{
  "title_zh": "AI 创业公司 Foo 完成 500 万美元种子轮融资",
  "summary_zh": "面向小企业的 AI 工具创业公司 Foo 宣布完成 500 万美元种子轮融资,由 Bar Capital 领投,多位天使投资人跟投。公司目前处于早期阶段,产品尚未公开发布。",
  "score": 28,
  "recommendation": "早期创业公司常规融资,关注度可低。",
  "tags": ["融资"]
}
```

## 示例 4 (中文来源,中国模型发布)

**输入 (source_lang=zh, title='DeepSeek-V3 技术报告：以 557B MoE 参数实现 GPT-4 级性能', text='DeepSeek 今日发布 DeepSeek-V3 技术报告。模型采用混合专家 (MoE) 架构,总参数量 685B,激活参数 37B。在 MMLU 上得分 88.5,超过 Claude 3.5 Sonnet 和 GPT-4o。训练成本仅 557.6 万美元,显著低于同级别竞品...'):**

**输出:**
```json
{
  "title_zh": "DeepSeek-V3 发布:557B MoE 模型以极低成本媲美 GPT-4o",
  "summary_zh": "DeepSeek 发布 V3 技术报告,模型采用 MoE 架构总参数 685B、激活参数 37B,在 MMLU (88.5)、HumanEval 等基准上超越 Claude 3.5 Sonnet。训练成本仅约 557 万美元,大幅低于 GPT-4 类模型。模型权重开源,支持商业使用。",
  "score": 91,
  "recommendation": "成本效益比极高的开源旗舰模型,中文能力突出,自托管团队优先评估。",
  "tags": ["模型发布", "国产模型", "开源", "训练"]
}
```

## 示例 5 (安全研究,中等分带)

**输入 (source_lang=en, title='Universal and Transferable Adversarial Attacks on Aligned Language Models', text='We demonstrate that it is possible to construct adversarial suffixes that cause aligned language models to generate objectionable content. These attacks transfer across different LLMs and are not easily defended against by current methods...'):**

**输出:**
```json
{
  "title_zh": "研究发现通用越狱后缀可攻击多种对齐大模型",
  "summary_zh": "CMU 与 Robustness 研究团队发现,通过构造对抗性后缀可绕过 ChatGPT、Claude、Llama 等主流模型的安全对齐,且该攻击可跨模型迁移。当前对抗训练和 RLHF 防御方法均难以有效抵御此类攻击。论文已公开,代码见 GitHub。",
  "score": 74,
  "recommendation": "AI 安全从业者和模型部署团队需关注,了解当前对齐方法的局限性。",
  "tags": ["安全", "研究论文", "评测"]
}
```

## 示例 6 (工具链更新,低分带)

**输入 (source_lang=en, title='LangChain v0.3.0 release: breaking changes to chains API', text='We are releasing LangChain v0.3.0 today. This release includes significant breaking changes to the chains API. The old LLMChain class has been deprecated in favor of the new LCEL (LangChain Expression Language) interface...'):**

**输出:**
```json
{
  "title_zh": "LangChain v0.3.0 发布,Chains API 重大改版",
  "summary_zh": "LangChain 发布 v0.3.0,核心 Chains API 有重大 breaking changes,旧版 LLMChain 类被废弃,迁移至 LCEL (LangChain Expression Language) 接口。使用 LangChain 的团队需评估迁移成本。",
  "score": 52,
  "recommendation": "使用 LangChain 的工程团队需安排迁移,新项目直接使用 LCEL 接口。",
  "tags": ["工具链", "开发者"]
}
```

## 示例 7 (政策类,高关注)

**输入 (source_lang=en, title='EU AI Act enters into force: key provisions and timeline', text='The European Union AI Act officially entered into force on August 1, 2024. The Act introduces a risk-based framework for AI regulation. High-risk AI systems will face strict requirements including conformity assessments, technical documentation, and ongoing monitoring...'):**

**输出:**
```json
{
  "title_zh": "欧盟 AI 法案正式生效:高风险 AI 系统面临严格合规要求",
  "summary_zh": "欧盟《人工智能法案》于 2024 年 8 月 1 日正式生效,采用风险分级监管框架。高风险 AI 系统(医疗、执法、教育等领域)须通过合规评估、保存技术文档并持续监控。通用 AI 模型 (GPAI) 若训练算力超 10^25 FLOP 须接受额外审查。不合规最高罚款达全球营收的 3%。",
  "score": 73,
  "recommendation": "在欧部署 AI 产品的团队需系统梳理合规义务,尤其关注 GPAI 条款对大模型的约束。",
  "tags": ["政策", "安全", "伦理"]
}
```

## 输出格式要求

1. 必须返回严格符合 EnrichmentSchema 的 JSON (由 output_config 强制)。
2. `title_zh`:1–200 字符,使用地道中文,不要逐字直译英文标题。
3. `summary_zh`:10–800 字符,2–4 句,总结核心事实 + 关键数字(如参数量、benchmark 分数、价格)。
4. `score`:0–100 整数,严格按准则打分。
5. `recommendation`:2–80 字符,一句话说明为什么 AI 从业者应该(或不应该)关注此条。
6. `tags`:从 30 个封闭标签中选 1–5 个,不创造新标签。

## 常见错误示例 (反例)

以下是不应该出现的输出形式:

### 错误 1:score 是小数
```json
{ "score": 72.5 }  // 错误 — score 必须是整数
```

### 错误 2:tags 包含不在列表中的标签
```json
{ "tags": ["模型发布", "创新技术"] }  // 错误 — "创新技术" 不在 30 个封闭标签中
```

### 错误 3:recommendation 超过 80 字符
```json
{ "recommendation": "这是一个非常重要的模型发布,对整个 AI 行业都有深远影响,所有从业者都应该立即关注并深入研究这个模型的技术细节和潜在应用场景。" }  // 错误 — 超过 80 字符
```

### 错误 4:summary_zh 少于 10 字符
```json
{ "summary_zh": "新模型发布" }  // 错误 — 太短,需要至少 10 字符
```

### 正确做法
- score: 整数 (例如 72, 85, 34)
- tags: 只从 30 个封闭标签中选取
- recommendation: 不超过 80 字符的单句,简洁有力
- summary_zh: 10–800 字符的 2–4 句描述,包含关键事实和数字
- title_zh: 地道中文标题,不逐字翻译英文,可意译提炼核心

## 系统说明

本系统处理来自多个来源的 AI 新闻,包括:英文科技媒体 (TechCrunch、The Verge、Ars Technica)、研究机构博客 (Anthropic、OpenAI、DeepMind)、社交媒体 (Twitter/X、Hacker News)、中文媒体 (公众号、微博、buzzing.cc) 等。

每条新闻都已经过去重处理 — 你看到的是唯一事件代表,无需担心重复。评分时专注于该条新闻本身的信息价值和行业影响力即可。所有输出将直接展示给中文 AI 从业者,请确保中文表达自然、专业、准确。

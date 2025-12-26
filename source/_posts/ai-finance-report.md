---
title: AI Agent 实战：股票研报撰写助手
date: 2025-12-26 09:31:05
tags:
  - ai
  - agent
categories:
  - ai
description: 介绍如何基于 LangGraph 构建自动化股票研报助手，通过流水线思维拆解任务，涵盖跨语言数据采集、财务指标工具化计算及递归生成长文本研报的实战方案。
---

## 前言

传统研报分析师的一天：在东方财富翻财报、在 Excel 算比率、在 Word 里敲字，最后发现数据还弄错了。用 ChatGPT 帮忙？三座大山挡住去路：

1. **数据幻觉**：AI 会编造一个看起来完美的"同比增长 12%"
2. **上下文限制**：几年的财报塞进去，AI 很快就"断片"
3. **逻辑碎片化**：无法自主完成"找对手 -> 算指标 -> 出结论"的长链路

**解决方案：流水线思维**。把任务拆成一条流水线，每个工位只负责一件事。本文基于 LangGraph 构建一个 6 节点的研报自动化工作流。

## 一、工作流

| 序号 | 节点                    | 功能         | 包含子任务                            |
| ---- | ----------------------- | ------------ | ------------------------------------- |
| 1    | collect_market_data     | 市场数据采集 | 深度搜索行业信息、提取竞品、下载财报  |
| 2    | calculate_financials    | 财务指标计算 | 计算毛利率、ROE 等核心指标            |
| 3    | analyze_and_visualize   | 分析与可视化 | 趋势分析、对比分析、生成 ECharts 图表 |
| 4    | collect_company_profile | 公司概况采集 | 主营业务、股东结构、基本信息（并行）  |
| 5    | consolidate_analysis    | 整合分析     | 估值模型、汇总所有数据                |
| 6    | generate_report         | 生成报告     | 递归生成深度研报 HTML                 |

## 二、核心实现

### 2.1 AkShare 桥接：跨语言数据采集

JS 生态缺少像 AkShare 这样成熟的金融数据库增么办呢？答案是构建 Python 桥梁，让 Node.js 通过 `child_process` 调用 Python 脚本。

**TypeScript 端**封装静态类：

```typescript
// akshare.ts
export class AkShare {
  private static execute(funcName: string, ...args: string[]): any {
    const command = `"${VENV_PYTHON}" "${BRIDGE_PATH}" ${funcName} ${args.join(
      ' '
    )}`
    const output = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    })
    return JSON.parse(output)
  }

  static getBalanceSheet(stockCode: string, year: string) {
    return this.execute('get_balance_sheet', stockCode, year)
  }
  static getIncomeStatement(stockCode: string, year: string) {
    return this.execute('get_income_statement', stockCode, year)
  }
}
```

**Python 端**接收参数，调用 AkShare，返回 JSON：

```python
# akshare_bridge.py
def clean_data(df):
    """JSON 不支持 NaN，必须转为 None"""
    return df.where(pd.notnull(df), None).to_dict(orient='records')

def handle_get_balance_sheet(stock_code, year):
    df = ak.stock_balance_sheet_by_yearly_em(symbol=stock_code)
    return clean_data(df[df['报告期'].str.startswith(year)])

if __name__ == '__main__':
    handlers = { 'get_balance_sheet': handle_get_balance_sheet, ... }
    result = handlers[sys.argv[1]](*sys.argv[2:])
    print(json.dumps(result, ensure_ascii=False))
```

### 2.2 状态定义

Agent 的"记忆"用 LangGraph 的 Annotation 定义：

```typescript
// types.ts
export const OverallState = Annotation.Root({
  stock_code: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
  stock_name: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
  year: Annotation<string[]>({ reducer: (x, y) => y ?? x, default: () => [] }),

  competitor_and_industry_data: Annotation<string>({ ... }),  // 行业数据
  competitor_info: Annotation<CompetitorInfoList>({ ... }),   // 竞品列表
  company_report: Annotation<Record<string, any>>({ ... }),   // 分析报告
  formatted_output: Annotation<string[]>({ ... }),            // 汇总输出
  final_report: Annotation<string>({ ... }),                  // 最终报告
});
```

### 2.3 节点 1：市场数据采集

这是流水线的"情报员"，一次性完成三件事：深度搜索行业信息、结构化提取竞品、采集财务报表。

**Prompt 1 - 深度搜索行业信息** (`get_competitor_and_industry_data_prompt`)：

```
请分析以下公司的竞争对手以及所处行业：
公司信息：
 - 市场：{market}
 - 公司名称：{stock_name}
 - 股票代码：{stock_code}

分析竞争对手的标准为：
1. 同行业内的主要上市公司
2. 业务模式相似的公司
3. 市值规模相近的公司
4. 主要业务重叠度高的公司

要求：
1.请返回3~5个竞争对手(需包含股票代码，公司名称，市场信息)，按竞争程度排序。
2.请返回关键财务比率的行业均值数据（如行业平均毛利率、净利率、市盈率等），并注明是什么行业

重要提示：
1.竞争对手只关注在A股或港股上市的公司，不关注美股等其他市场上市的公司或者未上市的公司
```

**Prompt 2 - 结构化提取竞品** (`get_competitor_info_prompt`)：

```
请从以下内容中，将竞争对手公司信息提取出来。

上下文：
{context}

输出格式:
- 将您的响应格式化为包含以下字段的 JSON 对象：
   - "competitors": 竞争对手公司信息
     - "stock_name": 公司名称
     - "stock_code": 股票代码（纯数字股票代码，不要带HK SZ等标识）
     - "market": 市场

Example:
{
    "competitors": [
        {
            "stock_name": "商汤科技",
            "stock_code": "00020",
            "market": "港股"
        }
    ]
}
```

**核心代码**：

```typescript
export async function collectMarketData(state: typeof OverallState.State) {
  // 1. 深度搜索（调用 DeepResearchAgent 多轮迭代搜索）
  const industryResult = await getCompetitorAndIndustryData(state)

  // 2. 结构化提取（withStructuredOutput 保证输出格式）
  const structuredLLM = llm.withStructuredOutput(CompetitorInfoListSchema)
  const competitorResult = await getCompetitorInfo({
    ...state,
    ...industryResult,
  })

  // 3. 采集财务报表（本公司 + 竞品，调用 AkShare 桥接）
  await getFinancialData({...state, ...competitorResult})

  return {competitor_and_industry_data, competitor_info}
}
```

**输出示例**：

```
competitor_info: {
  competitors: [
    { stock_name: "五粮液", stock_code: "000858", market: "A股" },
    { stock_name: "泸州老窖", stock_code: "000568", market: "A股" },
    { stock_name: "洋河股份", stock_code: "002304", market: "A股" }
  ]
}

生成文件:
- data/financial_statements/600519_2024_资产负债表.csv
- data/financial_statements/600519_2024_利润表.csv
- data/financial_statements/600519_2024_现金流量表.csv
- data/financial_statements/000858_2024_资产负债表.csv
- ...
```

### 2.4 节点 2：财务指标计算

不要让 LLM 算数！预定义 11 个计算工具，让 Agent 自主调用。

**System Prompt** (`analyze_system_prompt`)：

```
你是一名财务分析师，你的任务是根据用户传入的财务指标和三大会计表数据，完成如下的数据获取与计算任务。

1.毛利率、净利率、净资产收益率 (ROE)
2.资产负债率、流动比率、速动比率
3.总资产周转率、应收账款周转天数、存货周转天数
4.现金流匹配度、销售现金比率
5.权益乘数

#要求：
- 如果能直接获取到数据，就无需调用工具计算，否则需要调用工具计算，所有的比率都以百分比的形式给出
- 不需要描述获取或者计算的过程，只需给出结果即可
- 不允许自行杜撰编造数据

#输出格式：
请以以下JSON格式返回：
{
    "毛利率": 数值,
    "净利率": 数值,
    "净资产收益率": 数值,
    "资产负债率": 数值,
    "流动比率": 数值,
    "速动比率": 数值,
    "总资产周转率": 数值,
    "应收账款周转天数": 数值,
    "存货周转天数": 数值,
    "现金流匹配度": 数值,
    "销售现金比率": 数值,
    "权益乘数": 数值,
}
```

**User Prompt** (`analyze_user_prompt`)：

```
以下是{company_name} {year}年度的财务指标与三大会计表数据：
文件路径:{files0}
内容:
{report0}

文件路径:{files1}
内容:
{report1}

文件路径:{files2}
内容:
{report2}

文件路径:{files3}
内容:
{report3}
```

**核心代码**：

```typescript
const agent = createReactAgent({
  llm,
  tools: calculationTools, // 毛利率、ROE、资产负债率等 11 个计算工具
  messageModifier: new SystemMessage(formattedSystemPrompt),
})

const agentResponse = await agent.invoke({
  messages: [new HumanMessage(formattedUserPrompt)],
})
```

**输出示例**：

```json
{
  "毛利率": 91.96,
  "净利率": 52.49,
  "净资产收益率": 31.24,
  "资产负债率": 19.85,
  "流动比率": 3.68,
  "速动比率": 3.12,
  "总资产周转率": 0.35,
  "应收账款周转天数": 12.5,
  "存货周转天数": 1245.6,
  "现金流匹配度": 1.15,
  "销售现金比率": 98.72,
  "权益乘数": 1.25
}
```

生成文件: `data/financial_caculates/600519_2024年度财务计算结果.csv`

### 2.5 节点 3：分析与可视化

一个节点完成趋势分析、对比分析、ECharts 图表生成。

**趋势分析 User Prompt** (`analyze_financial_data_user_prompt`)：

```
以下是{company_name} 公司的过去三年财务数据：
文件:{files0}
内容:{report0}

文件:{files1}
内容:{report1}

文件:{files2}
内容:{report2}

请利用财务分析方法进行纵向的趋势分析
```

**对比分析 User Prompt** (`compare_company_report_user_prompt`)：

```
以下是基准公司：{source_name} 公司的过去三年财务数据：
文件:{source_files0}
内容:{source_report0}

文件:{source_files1}
内容:{source_report1}

文件:{source_files2}
内容:{source_report2}

以下是对比公司：{target_name} 公司的过去三年财务数据：
文件:{target_files0}
内容:{target_report0}

文件:{target_files1}
内容:{target_report1}

文件:{target_files2}
内容:{target_report2}

请利用财务分析方法对两家公司，分析基准公司相比对比公司的优劣势，完成对比分析报告
```

**System Prompt - ECharts 图表生成** (`analyze_financial_data_system_prompt_web`)：

```
你是一名资深财务分析师，能够根据用户需求生成数据分析和 ECharts 可视化代码。

**核心任务**：
分析用户提供的财务数据，生成 ECharts 图表配置，并输出最终的分析报告。

**工作流程**：

**阶段1：数据分析和可视化（使用 generate_chart 动作）**
- 分析财务数据，识别关键指标和趋势
- 生成 ECharts 图表配置（JSON 格式）
- 每次只生成一个图表，可多次调用

**阶段2：最终报告（使用 analysis_complete 动作）**
- 图表生成完毕后，生成包含所有图表和分析的完整报告

**ECharts 图表设计指南**：

**图表类型选择**：
- 时间序列/趋势数据 → line（折线图）
- 分类比较 → bar（柱状图）
- 占比分析 → pie（饼图）
- 多维指标对比 → radar（雷达图）
- 相关性分析 → scatter（散点图）

**金融数据可视化最佳实践**：
- 营收利润类：柱状图展示年度对比，线图展示趋势
- 财务比率类：雷达图展示综合表现
- 现金流类：堆叠柱状图展示流入流出
- 资产负债类：堆叠柱状图展示结构占比

**配色方案**：
- 主色调：#5470c6（蓝色）用于主要数据
- 增长/正向：#91cc75（绿色）
- 下降/警示：#ee6666（红色）
- 辅助色：#fac858（黄色）、#73c0de（浅蓝）

**响应格式（严格遵守 YAML）**：

**1. 生成图表时：**
action: "generate_chart"
reasoning: "说明为什么要生成这个图表"
chart:
  title: "图表标题"
  filename: "chart_name.html"
  type: "bar|line|pie|radar|scatter"
  option: |
    {
      "title": { "text": "图表标题", "left": "center" },
      "xAxis": { "type": "category", "data": ["2022", "2023", "2024"] },
      "yAxis": { "type": "value" },
      "series": [{ "name": "营业收入", "type": "bar", "data": [100, 120, 150] }]
    }

**2. 完成分析时：**
action: "analysis_complete"
final_report: |
  # 财务数据分析报告
  ## 关键发现
  1. 营业收入稳步增长...
  ## 图表分析
  ### 营业收入趋势
  <div id="chart_revenue"></div>
  从图中可以看出...

**重要约束**：
1. 每次只选择一种动作，不要混合
2. ECharts option 必须是合法的 JSON 格式
3. 数据必须来自用户提供的财务数据，不要编造
4. 图表文件名使用有意义的英文命名
5. 最终报告中引用图表使用 <div id="chart_xxx"></div> 占位符
```

**两个动作的使用时机**：

LLM 在分析过程中通过动作进行"状态切换"，形成一个简单的循环：

```
开始 → generate_chart → generate_chart → ... → analysis_complete → 结束
       ↑______________________|
            (可多次循环)
```

- **`generate_chart`**：每次生成一个图表，图表会被保存到 `this.charts` 数组中，可多次调用
- **`analysis_complete`**：终止信号，输出最终报告后结束循环

举个例子：分析贵州茅台时，LLM 可能会：

1. `generate_chart` → 生成"营收趋势折线图"（保存到 charts 数组）
2. `generate_chart` → 生成"利润结构饼图"（保存到 charts 数组）
3. `analysis_complete` → 输出完整分析报告，循环结束

**核心代码**：

```typescript
export async function analyzeAndVisualize(state: typeof OverallState.State) {
  // 1. 趋势分析（纵向看自己，生成 ECharts 图表）
  const analyzeResult = await analyzeFinancialData(state)

  // 2. 对比分析（横向看对手，生成对比图表）
  const compareResult = await generateCompareCompanyReport({
    ...state,
    ...analyzeResult,
  })

  // 3. 汇总报告
  const mergeResult = await mergerReports({...state, ...compareResult})

  return {company_report, compare_company_report, formatted_output}
}
```

**输出示例**：

```
生成文件:
- analyze_agent_outputs/session_xxx/revenue_trend.html      (营业收入趋势图)
- analyze_agent_outputs/session_xxx/profit_margin.html      (利润率分析图)
- analyze_agent_outputs/session_xxx/debt_ratio_trend.html   (资产负债率趋势图)
- analyze_agent_outputs/session_xxx/最终分析报告.md
- compare_company_report_outputs/session_xxx/comparison_bar.html  (对比柱状图)
- compare_company_report_outputs/session_xxx/最终分析报告.md

formatted_output 示例:
【财务数据分析结果开始】
# 贵州茅台财务趋势分析报告
## 盈利能力分析
贵州茅台2022-2024年毛利率保持在91%以上，净利率稳定在52%左右...
【财务数据分析结果结束】

【对比分析结果开始】
# 贵州茅台与五粮液对比分析
## 盈利能力对比
贵州茅台毛利率91.96%，五粮液75.79%，茅台在成本控制上具有压倒性优势...
【对比分析结果结束】
```

### 2.6 节点 4：公司概况采集

三个子任务**并行执行**，提升效率。

**主营业务 Prompt** (`get_business_info_prompt`)：

```
请获取以下公司的主营业务与核心竞争力：

公司信息：
 - 市场：{market}
 - 公司名称：{stock_name}
 - 股票代码：{stock_code}

名词解释：
主营业务: 按产品/地区划分的收入和利润构成。
核心竞争力: 公司的技术专利、品牌价值、渠道优势、成本控制能力等描述性文本。
行业地位: 市场份额、行业排名、主要竞争对手等信息。
```

**公司基本信息 Prompt** (`collect_stock_info_prompt`)：

```
你是一个专业的股票信息整理师，请根据以下公司信息，整理其基本介绍信息：
公司信息：
 - 市场：{market}
 - 公司名称：{stock_name}
 - 股票代码：{stock_code}

请整理以下内容并生成报告：
1. 公司简介
2. 主营业务
3. 经营范围
4. 行业地位
5. 发展历程（如有）
```

**核心代码**：

```typescript
export async function collectCompanyProfile(state: typeof OverallState.State) {
  // 三个子任务并行执行（互不依赖）
  const [businessResult, shareholderResult, companyResult] = await Promise.all([
    getBusinessInfo(state), // DeepResearchAgent 深度搜索
    getShareholderInfo(state), // AkShare 获取十大股东等数据
    getCompanyInfo(state), // AkShare + LLM 整理
  ])

  return {business_info, shareholder_info, company_info}
}
```

**输出示例**：

```
生成文件:
- final_output/主营业务与核心竞争力.md
- final_output/股东信息数据.md
- final_output/公司信息数据.md

business_info 示例:
# 贵州茅台主营业务与核心竞争力
## 主营业务
- 茅台酒：占营收85%，毛利率95%以上
- 系列酒：占营收15%，毛利率75%左右
## 核心竞争力
- 品牌价值：连续多年蝉联中国白酒品牌价值榜首
- 产能稀缺：受限于茅台镇特殊地理环境，产能扩张困难
- 渠道控制：直销占比持续提升，价格管控能力强

shareholder_info 示例:
# 贵州茅台股东结构分析
## 十大股东
1. 中国贵州茅台酒厂(集团)有限责任公司 - 54.00%
2. 香港中央结算有限公司 - 7.82%
...
```

### 2.7 节点 5&6：整合与生成

整合所有数据，然后递归生成深度研报。

**估值模型 Prompt** (`buildValuationModelPrompt` 动态生成)：

```
你是一名金融分析师，请根据以下{company_name} 公司的信息，构建估值与预测模型，
模拟关键变量变化对财务结果的影响，最后生成一份报告。

{year}年的财务数据如下：
文件:{files0}
内容:{report0}
...

竞争对手与行业均值数据如下：
{competitor_and_industry_data}

主营业务与核心竞争力如下：
{business_info}
```

**大纲生成 Prompt** (`outline_prompt`)：

````
你是一位顶级金融分析师和研报撰写专家。请基于以下背景和财务研报汇总内容，
生成一份详尽的《{company_name}公司研报》分段大纲，要求：
- 以yaml格式输出，务必用```yaml和```包裹整个yaml内容，便于后续自动分割。
- 每一项为一个主要部分，每部分需包含：
  - part_title: 章节标题
  - part_desc: 本部分内容简介
- 章节需覆盖公司基本面、财务分析、行业对比、估值与预测、治理结构、投资建议、风险提示、数据来源等。
- 只输出yaml格式的分段大纲，不要输出正文内容。

【背景说明开始】
{background}
【背景说明结束】

【财务研报汇总内容开始】
{report_content}
【财务研报汇总内容结束】
````

**章节生成 Prompt** (`generate_section_prompt`)：

```
你是一位顶级金融分析师和研报撰写专家。请基于以下内容，直接输出"{part_title}"这一部分的完整研报内容。

**重要要求：**
1. 直接输出完整可用的研报内容，以"## {part_title}"开头
2. 在正文中引用数据、事实等信息时，适当位置插入参考资料符号（如[1][2][3]），符号需与文末引用文献编号一致
3. 不要输出任何【xxx开始】【xxx结束】等分隔符
4. 不要输出"建议补充"、"需要添加"等提示性语言
5. 不要编造数据
6. 内容要详实、专业，可直接使用

**数据来源标注：**
- 财务数据标注：（数据来源：东方财富-数据中心-年报季报-业绩快报[1]）
- 主营业务信息标注：（数据来源：互联网[2]）
- 股东结构信息标注：（数据来源：东方财富网-股东信息[3]）

【本次任务】
{part_title}

【已生成前文】
{prev_content}

【背景说明开始】
{background}
【背景说明结束】

【财务研报汇总内容开始】
{report_content}
【财务研报汇总内容结束】
```

**核心代码**：

```typescript
// 节点5：整合分析
export async function consolidateAnalysis(state: typeof OverallState.State) {
  const valuationResult = await generateValuationModel(state)
  const summaryResult = await summarizeFirstStageData({...state, ...valuationResult})
  return { valuation_model, final_report }
}

// 节点6：递归生成深度研报
export async function generateReport(state: typeof OverallState.State) {
  // 1. 生成大纲
  const parts = await generateOutline(state.stock_name, reportContent, background)

  // 2. 逐章节递归生成（突破 LLM 上下文限制）
  for (const part of parts) {
    const sectionText = await generateSection(part.part_title, prevContent, ...)
    fullReport.push(sectionText)
    prevContent = fullReport.join('\n\n')  // 传递前文作为上下文
  }

  // 3. 输出 HTML 报告，内嵌所有 ECharts 图表
}
```

**输出示例**：

```
节点5 - 整合分析:
生成文件:
- final_output/估值与预测模型.md
- final_output/财务研报汇总_20251223012602.md

节点6 - 生成报告:
生成大纲: 5 个章节
  1. 公司概况与行业地位
  2. 财务数据深度分析
  3. 竞争格局与行业对比
  4. 估值分析与投资建议
  5. 风险提示与数据来源

递归生成:
  - 正在生成：公司概况与行业地位 (1/5)
  - 正在生成：财务数据深度分析 (2/5)
  - ...

最终输出:
- final_output/深度财务研报分析_20251223012602.md
- final_output/深度财务研报分析_20251223012602.html (内嵌 ECharts 图表)
```

## 四、运行效果

![](./ai-finance-report/1.jpg)

![](./ai-finance-report/2.jpg)

## 五、总结

这套系统的核心是"结构化计算 + AI 推理"：前半段用 Python 桥接 AkShare 采集数据并计算指标，后半段让 LLM 生成分析报告和 ECharts 可视化。通过 LangGraph 串成 6 个节点，每个节点只做一件事。

未来可以往两个方向走：一是接入更多数据源（如新闻舆情、研报库），让 AI 分析更全面；二是加入实时监控和定时任务，把单次生成改造成持续跟踪系统。技术上可以尝试用 Agent 自主决策采集哪些数据、生成哪些图表，而不是写死流程。

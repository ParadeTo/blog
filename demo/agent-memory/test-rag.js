/**
 * RAG 混合检索 Demo：写入 3 条记忆 → 搜索 "上次那个航班" → 展示得分
 */
import { initDB, query, close } from './db.js'
import { storeMemory } from './memory-store.js'
import { searchMemory } from './memory-search.js'

async function main() {
  // 1. 初始化数据库（建表 + 索引）
  await initDB()
  console.log()

  // 2. 写入 3 条示例记忆
  const memories = [
    {
      sessionId: 'session_001', routingKey: 'user:xiaoming',
      userMessage: '帮我查一下 CA1234 航班的情况',
      assistantReply: 'CA1234 航班延误了 2 小时，目前预计 15:30 起飞。建议你改签到 CA1235，16:00 出发。',
      summary: '查询 CA1234 航班延误信息并提供改签建议',
      tags: ['travel', 'flight'], turnTs: 1713168000000,
    },
    {
      sessionId: 'session_002', routingKey: 'user:xiaoming',
      userMessage: 'React 和 Vue 哪个好？',
      assistantReply: '两者各有优势。React 生态更大、社区更活跃，适合大型项目；Vue 学习曲线更平缓，上手快。',
      summary: '讨论了 React 和 Vue 框架的优缺点',
      tags: ['frontend'], turnTs: 1713168001000,
    },
    {
      sessionId: 'session_003', routingKey: 'user:xiaoming',
      userMessage: '帮我订下周三的机票',
      assistantReply: '已订东航 MU5100，下周三 08:30 从上海虹桥出发，10:50 到北京首都。',
      summary: '帮用户订了下周三的机票，东航 MU5100',
      tags: ['travel', 'flight'], turnTs: 1713168002000,
    },
  ]

  console.log('--- 写入记忆 ---')
  for (const m of memories) {
    const id = await storeMemory(m)
    console.log(`  ✓ [${id}] ${m.summary}`)
  }
  console.log()

  // 3. 搜索 "上次那个航班"
  console.log('--- 搜索: "上次那个航班" ---')
  const results = await searchMemory({
    queryText: '上次那个航班',
    routingKey: 'user:xiaoming',
    topK: 3,
  })

  for (const r of results) {
    console.log(`  [id: ${r.id}] score: ${Number(r.score).toFixed(3)}`)
    console.log(`    vec_score: ${Number(r.vec_score).toFixed(3)}  text_score: ${Number(r.text_score).toFixed(3)}`)
    console.log(`    summary: ${r.summary}`)
    console.log(`    user_message: ${r.user_message}`)
    console.log(`    tags: ${r.tags}`)
    console.log()
  }

  // 4. 再搜一个精确关键字 "ERR_500" 对比
  console.log('--- 搜索: "CA1234" (精确关键字) ---')
  const results2 = await searchMemory({
    queryText: 'CA1234',
    routingKey: 'user:xiaoming',
    topK: 3,
  })

  for (const r of results2) {
    console.log(`  [id: ${r.id}] score: ${Number(r.score).toFixed(3)}`)
    console.log(`    vec_score: ${Number(r.vec_score).toFixed(3)}  text_score: ${Number(r.text_score).toFixed(3)}`)
    console.log(`    summary: ${r.summary}`)
    console.log()
  }

  await close()
}

main().catch(e => { console.error(e); process.exit(1) })

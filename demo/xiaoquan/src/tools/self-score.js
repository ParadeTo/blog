/**
 * self-score.js — 5维加权自评分
 *
 * 对齐 Python xiaopaw-team 的 tools/self_score.py
 */

export const DEFAULT_WEIGHTS = {
  completeness: 0.20,
  selfReview: 0.30,
  hardConstraints: 0.20,
  clarity: 0.15,
  timeliness: 0.15,
}

const REQUIRED_DIMS = new Set(Object.keys(DEFAULT_WEIGHTS))

export function computeSelfScore(breakdown, {weights = DEFAULT_WEIGHTS} = {}) {
  for (const dim of REQUIRED_DIMS) {
    if (!(dim in breakdown)) throw new Error(`missing dimension: ${dim}`)
    if (breakdown[dim] < 0 || breakdown[dim] > 1) throw new Error(`dim ${dim}=${breakdown[dim]} out of [0,1]`)
  }
  const total = [...REQUIRED_DIMS].reduce((sum, k) => sum + breakdown[k] * weights[k], 0)
  return Math.round(total * 100) / 100
}

function tryParseJsonObj(text) {
  if (!text) return null
  try {
    const obj = JSON.parse(text)
    if (obj && typeof obj === 'object' && 'self_score' in obj) return obj
  } catch {}
  // 区块匹配
  const regex = /\{[\s\S]*?"self_score"[\s\S]*?\}/g
  let m
  while ((m = regex.exec(text)) !== null) {
    const balanced = extractBalancedBraces(text, m.index)
    if (!balanced) continue
    try {
      const obj = JSON.parse(balanced)
      if (obj && 'self_score' in obj) return obj
    } catch {}
  }
  return null
}

function extractBalancedBraces(text, start) {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

export function extractSelfScoreFromTaskOutput(text) {
  const obj = tryParseJsonObj(typeof text === 'string' ? text : JSON.stringify(text))
  if (!obj) return null
  const score = typeof obj.self_score === 'number' ? obj.self_score : null
  if (score === null) return null
  return {score, breakdown: obj.breakdown || null}
}

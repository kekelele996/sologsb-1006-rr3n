import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.navigator = dom.window.navigator
globalThis.localStorage = dom.window.localStorage
globalThis.structuredClone = globalThis.structuredClone || (v => JSON.parse(JSON.stringify(v)))

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const store = await vite.ssrLoadModule('/src/lib/store.ts')
await vite.close()

import { get } from 'svelte/store'

let passed = 0, failed = 0
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`PASS  ${name}`) }
  else { failed++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

const { desk } = store
const s0 = get(desk)
// demo: cue-101/102 confirmed, cue-103/104 pending
const confirmedIds = s0.cues.filter(c => c.status === 'confirmed').map(c => c.id)
check('初始有 2 段已确认', confirmedIds.length === 2, confirmedIds.join(','))

// 可抽检段落 = 已确认
const eligible0 = store.reviewableCues(get(desk)).map(c => c.id)
check('可抽检=已确认段落', eligible0.length === 2 && eligible0.includes('cue-101'))

// 建单
const sheetId = store.createReviewSheet()
check('建单返回 id', typeof sheetId === 'string')
const sheet = get(desk).reviewSheets.find(x => x.id === sheetId)
check('单内含 2 段', sheet.items.length === 2)
check('单为未结束状态', sheet.finishedAt === null)
check('条目原文快照保留', sheet.items[0].originalText.length > 0)
check('条目初始待检', sheet.items.every(i => i.state === 'pending'))

// 未结束前：同一段不能再被抽检
check('未结束单占用段落不可再抽', store.reviewableCues(get(desk)).length === 0)
// 再次建单返回同一张单（不会产生第二张）
const againId = store.createReviewSheet()
check('存在未结束单时复用同一张', againId === sheetId)
check('没有产生重复单', get(desk).reviewSheets.length === 1)

const [item1, item2] = sheet.items

// 没打分不能确认
check('未打分不能确认问题', store.confirmReviewItem(sheetId, item1.id, true) === false)
store.saveReviewDraft(sheetId, item1.id, { score: 2, issues: ['omission', 'number'] })
// 有问题但缺修正稿/原因
check('有问题缺修正稿被拦截', store.confirmReviewItem(sheetId, item1.id, true) === false)
store.saveReviewDraft(sheetId, item1.id, { revision: '修正后的字幕内容', reason: '漏译关键句且数字错误' })
check('填写完整后返修保存成功', store.confirmReviewItem(sheetId, item1.id, true) === true)
const after1 = get(desk)
const cue1 = after1.cues.find(c => c.id === item1.cueId)
check('舞台 cue 写入修正稿', cue1.revisedText === '修正后的字幕内容')
check('stageText 采用修正稿', store.stageText(cue1) === '修正后的字幕内容')
check('原稿 text 未被覆盖', cue1.text === item1.originalText)
const saved1 = after1.reviewSheets[0].items[0]
check('条目状态为 issue', saved1.state === 'issue' && saved1.issues.length === 2)
check('返修时间已记录', saved1.reviewedAt.length > 0)

// 第二段：无问题，5 分
store.saveReviewDraft(sheetId, item2.id, { score: 5 })
check('无问题段确认成功', store.confirmReviewItem(sheetId, item2.id, false) === true)
const saved2 = get(desk).reviewSheets[0].items[1]
check('无问题条目状态 ok', saved2.state === 'ok')
check('无问题条目无问题勾选残留', saved2.issues.length === 0)

// 还有 pending 才能结束——这里已全确认
check('全部确认后可结束', store.finishReviewSheet(sheetId) === true)
const finished = get(desk).reviewSheets[0]
check('结束时间已写', finished.finishedAt !== null)

// 结束后再次结束无效
check('已结束单不能重复结束', store.finishReviewSheet(sheetId) === false)

// 发言人汇总
const stats = store.speakerReviewStats(finished)
check('汇总按发言人生成', stats.length >= 1)
const row = stats.find(r => r.speakerId === 'sp-1')
check('抽检数=2', row.total === 2)
check('问题数=1', row.problemCount === 1)
check('平均分=3.5（(2+5)/2）', row.averageScore === 3.5, String(row.averageScore))
check('问题分类计数：漏译1、数字1', row.issueCounts.omission === 1 && row.issueCounts.number === 1)
check('问题分类计数：术语0、表达0', row.issueCounts.terminology === 0 && row.issueCounts.expression === 0)

// 旧单结束后段落可再次抽检
const eligibleAfter = store.reviewableCues(get(desk)).map(c => c.id)
check('结束后段落可再次抽检', eligibleAfter.length === 2)

// 结束后新建单
const id2 = store.createReviewSheet()
check('结束后可建新单', id2 !== null && id2 !== sheetId)
const sheet2 = get(desk).reviewSheets.find(x => x.id === id2)

// 新确认段落可追加进未结束单
// 手工把 cue-103 设为 confirmed（同发言人 sp-1、live 场次）
store.setCueStatus('cue-103', 'confirmed')
const added = store.appendReviewItems(id2)
check('追加新确认段落=1', added === 1)
const sheet2b = get(desk).reviewSheets.find(x => x.id === id2)
check('新单条目数=3', sheet2b.items.length === 3)
check('追加条目为 cue-103', sheet2b.items.some(i => i.cueId === 'cue-103'))
check('重复追加不产生重复', store.appendReviewItems(id2) === 0)

// 草稿持久化：写入 localStorage 后重新加载状态（模拟刷新）
store.saveReviewDraft(id2, sheet2b.items[0].id, { score: 4, issues: ['terminology'] })
const persistedRaw = localStorage.getItem('conference-cue-desk-v1')
check('草稿写入 localStorage', persistedRaw.includes('terminology'))
const reparsed = JSON.parse(persistedRaw)
const persistedSheet = reparsed.reviewSheets.find(x => x.id === id2)
check('刷新后仍可继续：未结束单存在', persistedSheet && persistedSheet.finishedAt === null)
const draftItem = persistedSheet.items[0]
check('刷新后草稿评分与问题保留', draftItem.score === 4 && draftItem.issues.includes('terminology'))

// 未结束前不能结束
check('有待检项时结束被拦截', store.finishReviewSheet(id2) === false)

// 待检项中：ok 项不要求问题
// 确认除第一项（保留其草稿不确认）之外的条目
for (const item of sheet2b.items.slice(1)) {
  if (item.state !== 'pending') continue
  store.saveReviewDraft(id2, item.id, { score: 5 })
  store.confirmReviewItem(id2, item.id, false)
}
const stillPending = get(desk).reviewSheets.find(x => x.id === id2).items.filter(i => i.state === 'pending')
check('草稿未点确认仍保持待检', stillPending.length === 1)
// 清空误勾问题后以无问题确认
store.saveReviewDraft(id2, stillPending[0].id, { issues: [] })
store.confirmReviewItem(id2, stillPending[0].id, false)
check('全部确认后结束成功', store.finishReviewSheet(id2) === true)

// 退回重评只在未结束单可用（已结束 -> 状态不变）
const finishedItem = get(desk).reviewSheets.find(x => x.id === id2).items[0]
store.reopenReviewItem(id2, finishedItem.id)
check('已结束单不能退回重评', get(desk).reviewSheets.find(x => x.id === id2).items[0].state === 'ok')

console.log(`\n${passed}/${passed + failed} passed`)
process.exit(failed ? 1 : 0)

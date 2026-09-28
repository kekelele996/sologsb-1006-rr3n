import { mount, unmount, tick } from 'svelte'
import Page from '../src/routes/+page.svelte'
import '../src/app.css'

const results = []
export function check(name, cond, detail = '') {
  results.push({ name, ok: Boolean(cond), detail })
}
const qs = (sel, root = document) => root.querySelector(sel)
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)]
const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '')
const click = el => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
const wait = ms => new Promise(r => setTimeout(r, ms))

export async function run() {
  results.length = 0
  const errors = []
  window.addEventListener('error', e => errors.push(String(e.message)))

  const app = document.createElement('div')
  document.body.appendChild(app)
  const component = mount(Page, { target: app })
  await tick(); await wait(80)

  check('顶部导航含质量抽检', qsa('nav button').some(b => txt(b).includes('质量抽检')))
  check('舞台区存在', txt(document.body).includes('舞台字幕与紧急通知'))

  click(qsa('nav button').find(b => txt(b).includes('质量抽检')))
  await wait(60)
  check('抽检空状态标题', txt(document.body).includes('段落评分、修正稿与发言人汇总'))
  check('空状态建单按钮', qsa('button').some(b => txt(b).includes('从已确认段落建抽检单')))

  click(qsa('button').find(b => txt(b).includes('从已确认段落建抽检单')))
  await wait(60)
  check('建单后出现完成进度', txt(document.body).includes('完成进度'))
  check('建单后出现发言人汇总', txt(document.body).includes('发言人汇总'))

  const articles = qsa('article')
  check('单内条目=已确认段落(2)', articles.length === 2, String(articles.length))
  check('条目含原稿', txt(articles[0]).includes('urban heat island'))
  check('四类问题按钮齐全', ['漏译', '术语', '数字', '表达'].every(t => qsa('button', articles[0]).some(b => txt(b) === t)))
  check('1-5 分按钮齐全', [1, 2, 3, 4, 5].every(n => qsa('button', articles[0]).some(b => txt(b) === String(n))))
  check('未打分时确认无问题禁用', qsa('button', articles[0]).find(b => txt(b).includes('确认无问题'))?.hasAttribute('disabled') === true)
  check('未勾问题时返修禁用', qsa('button', articles[0]).find(b => txt(b).includes('保存返修'))?.hasAttribute('disabled') === true)

  click(qsa('button').find(b => txt(b).includes('全部确认并结束')))
  await wait(60)
  check('有待检时点结束被拦截', txt(document.body).includes('仍有段落未确认'))

  click(qsa('button', articles[0]).find(b => txt(b) === '漏译'))
  click(qsa('button', articles[0]).find(b => txt(b) === '数字'))
  click(qsa('button', articles[0]).find(b => txt(b) === '2'))
  await wait(80)
  const textareas = qsa('textarea', articles[0])
  check('勾问题后出现修正稿+原因输入框', textareas.length >= 2)
  const setVal = (el, v) => {
    el.value = v
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
  }
  setVal(textareas[0], '城市热岛效应在全城分布不均。')
  setVal(textareas[1], '漏译 not evenly distributed，且数字误读。')
  await wait(80)
  click(qsa('button', articles[0]).find(b => txt(b).includes('保存返修并采用修正稿')))
  await wait(80)
  check('第一段显示有返修', txt(articles[0]).includes('有返修'))
  check('第一段显示修正稿', txt(articles[0]).includes('城市热岛效应在全城分布不均。'))
  check('第一段显示原因', txt(articles[0]).includes('not evenly distributed'))
  check('第一段显示舞台采用提示', txt(articles[0]).includes('舞台现采用修正稿'))
  check('第一段保留原稿区块', txt(articles[0]).includes('原稿（播出留档）'))

  click(qsa('nav button').find(b => txt(b).includes('现场传译')))
  await wait(60)
  check('舞台显示修正稿', txt(document.body).includes('城市热岛效应在全城分布不均。'))
  check('舞台显示已采用提示', txt(document.body).includes('已采用抽检修正稿'))
  check('队列原稿仍可回看', txt(document.body).includes('The urban heat island effect is not evenly distributed'))
  check('队列有已返修徽标', txt(document.body).includes('已返修'))
  check('导航红点待检=1', qsa('nav .bg-red-500').some(el => txt(el) === '1'))

  click(qsa('nav button').find(b => txt(b).includes('质量抽检')))
  await wait(60)
  const arts = qsa('article')
  click(qsa('button', arts[1]).find(b => txt(b) === '5'))
  await wait(80)
  click(qsa('button', arts[1]).find(b => txt(b).includes('确认无问题')))
  await wait(80)
  check('第二段显示无问题', txt(arts[1]).includes('无问题'))
  check('进度 2/2', txt(document.body).includes('完成进度 2 / 2'))

  click(qsa('button').find(b => txt(b).includes('全部确认并结束')))
  await wait(60)
  check('出现二次确认按钮', qsa('button').some(b => txt(b).includes('再次点击确认结束')))
  click(qsa('button').find(b => txt(b).includes('再次点击确认结束')))
  await wait(120)
  check('结束后已锁定', txt(document.body).includes('已结束 · 已锁定'))
  check('汇总为最终结果', txt(document.body).includes('最终结果'))
  const table = qs('table')
  check('汇总表头齐全', ['抽检数', '问题数', '平均分'].every(t => txt(table).includes(t)))
  check('汇总平均分 3.5', txt(table).includes('3.5'))
  check('发言人问题数=1', qsa('tbody tr', table).some(tr => txt(tr).includes('Dr. Maya Chen') && /\b1\b/.test(txt(tr))))
  check('结束后无退回按钮', !qsa('button').some(b => txt(b).includes('退回待检重评')))
  check('结束后入口恢复建单', qsa('button').some(b => txt(b).includes('从已确认段落建抽检单')))
  click(qsa('button').find(b => txt(b).includes('从已确认段落建抽检单')))
  await wait(80)
  check('旧单结束后可再建单(2 段)', qsa('article').length === 2)
  // 进行中单期间，可通过"其他抽检单"回看已结束单
  check('存在其他抽检单区块', txt(document.body).includes('其他抽检单'))
  const historyCard = qsa('button').find(b => txt(b).includes('段返修') && txt(b).includes('已结束'))
  check('其他抽检单中可见已结束单卡片', !!historyCard)
  click(historyCard)
  await wait(80)
  check('回看已结束单显示锁定标记', txt(document.body).includes('已结束 · 已锁定'))
  check('回看时无退回重评按钮', !qsa('button').some(b => txt(b).includes('退回待检重评')))
  check('回看时汇总平均分 3.5', txt(document.body).includes('3.5'))
  check('可返回进行中的抽检单', qsa('button').some(b => txt(b).includes('返回进行中的抽检单')))
  click(qsa('button').find(b => txt(b).includes('返回进行中的抽检单')))
  await wait(80)
  check('返回后回到进行中单（追加按钮）', qsa('button').some(b => txt(b).includes('追加新确认段落')))

  // 草稿重开：勾术语+4分，不确认，刷新前检查 localStorage
  const a2 = qsa('article')[0]
  click(qsa('button', a2).find(b => txt(b) === '术语'))
  click(qsa('button', a2).find(b => txt(b) === '4'))
  await wait(120)
  const saved = JSON.parse(localStorage.getItem('conference-cue-desk-v1'))
  const openSheet = saved.reviewSheets.find(s => !s.finishedAt)
  check('草稿写入本地：问题保留', openSheet.items[0].issues.includes('terminology'))
  check('草稿写入本地：评分保留', openSheet.items[0].score === 4)

  check('运行期无 window 错误', errors.length === 0, errors.join(' | '))

  unmount(component)
  app.remove()
  return results
}

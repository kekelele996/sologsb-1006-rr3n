<script lang="ts">
  import Button from 'flowbite-svelte/Button.svelte'
  import {
    ISSUE_TYPES, appendReviewItems, confirmReviewItem, createReviewSheet, desk, finishReviewSheet,
    issueLabel, reopenReviewItem, reviewableCues, saveReviewDraft, speakerName, speakerReviewStats,
    stageText
  } from './store'
  import type { IssueType, ReviewItem, ReviewSheet } from './types'

  let selectedSheetId: string | null = null
  let confirmFinish = false
  let expanded = true
  let notice = ''
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  $: sheetList = ([...$desk.reviewSheets] as ReviewSheet[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  $: openSheetCurrent = $desk.reviewSheets.find((item: ReviewSheet) => !item.finishedAt)
  // 回看历史单时优先选中单；否则未结束单优先，最后回落最近一张（刚结束的汇总仍留在屏幕上）
  $: viewingFinished = sheetList.find((item: ReviewSheet) => item.id === selectedSheetId && item.finishedAt)
  $: activeSheet = (viewingFinished || openSheetCurrent || sheetList.find((item: ReviewSheet) => item.id === (selectedSheetId || '')) || sheetList[0] || null) as ReviewSheet | null
  $: open = openSheetCurrent
  $: eligible = reviewableCues($desk)
  $: doneCount = activeSheet && !activeSheet.finishedAt ? activeSheet.items.filter(item => item.state !== 'pending').length : 0
  $: stats = activeSheet ? speakerReviewStats(activeSheet) : []

  function flash(message: string) {
    notice = message
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice = '' }, 3000)
  }
  function startSheet() {
    if (open) { selectedSheetId = open.id; flash('继续未结束的抽检单。'); return }
    const id = createReviewSheet()
    if (id) { selectedSheetId = id; confirmFinish = false; flash('抽检单已从本场已确认段落建立。') }
    else flash('暂无可抽检段落：需要先在现场队列确认段落。')
  }
  function appendMore() {
    if (!activeSheet) return
    const added = appendReviewItems(activeSheet.id)
    flash(added ? `已追加 ${added} 个新确认段落。` : '没有可追加的新确认段落。')
  }
  function toggleIssue(item: ReviewItem, type: IssueType) {
    if (item.state !== 'pending') return
    const issues = item.issues.includes(type) ? item.issues.filter(id => id !== type) : [...item.issues, type]
    saveReviewDraft(activeSheet!.id, item.id, { issues })
  }
  function setScore(item: ReviewItem, score: number) {
    if (item.state !== 'pending') return
    saveReviewDraft(activeSheet!.id, item.id, { score })
  }
  function confirmItem(item: ReviewItem, asIssue: boolean) {
    if (!activeSheet) return
    if (!item.score) { flash('请先给本段打 1–5 分。'); return }
    if (asIssue) {
      if (!item.issues.length) { flash('请勾选至少一类问题。'); return }
      if (!item.revision.trim()) { flash('有问题的段落必须填写修正稿。'); return }
      if (!item.reason.trim()) { flash('请填写问题原因。'); return }
    }
    if (confirmReviewItem(activeSheet.id, item.id, asIssue)) {
      confirmFinish = false
      flash(asIssue ? '已保存返修：舞台改用修正稿，原稿可回看。' : '本段确认无问题。')
    }
  }
  function resetItem(item: ReviewItem) {
    if (!activeSheet) return
    reopenReviewItem(activeSheet.id, item.id)
    flash('已退回待检，可重新评分。')
  }
  function tryFinish() {
    if (!activeSheet) return
    if (activeSheet.items.some(item => item.state === 'pending')) { flash('仍有段落未确认，全部确认后才能结束。'); return }
    if (!confirmFinish) { confirmFinish = true; flash('请再次确认：结束后将按发言人锁定汇总。'); return }
    if (finishReviewSheet(activeSheet.id)) {
      confirmFinish = false
      flash('抽检单已结束，按发言人汇总已生成。')
    }
  }
  function scoreClass(score: number) {
    if (score >= 4) return 'border-emerald-300 bg-emerald-50 text-emerald-800'
    if (score >= 3) return 'border-amber-300 bg-amber-50 text-amber-800'
    return 'border-red-300 bg-red-50 text-red-800'
  }
  function stateLabel(item: ReviewItem) {
    return item.state === 'issue' ? '有返修' : item.state === 'ok' ? '无问题' : '待检'
  }
  function stateClass(item: ReviewItem) {
    return item.state === 'issue'
      ? 'bg-red-100 text-red-800'
      : item.state === 'ok'
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-slate-100 text-slate-600'
  }
  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  }
  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }
</script>

<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
  <div>
    <p class="text-[10px] font-black uppercase tracking-[.18em] text-teal-700">播出质量抽检 · 返修依据留档</p>
    <h1 class="mt-1 text-3xl font-black">段落评分、修正稿与发言人汇总</h1>
    <p class="mt-2 text-sm text-slate-500">从本场已确认段落建单；同一段落在一张单结束前不会重复抽检。</p>
  </div>
  <div class="flex gap-2">
    {#if open}
      <Button color="light" on:click={() => (expanded = !expanded)}>{expanded ? '收起明细' : '展开明细'}</Button>
      <Button color="blue" on:click={startSheet}>继续未结束单（{open.items.filter(i => i.state === 'pending').length} 待检）</Button>
    {:else}
      <Button color="green" disabled={!eligible.length} on:click={startSheet}>从已确认段落建抽检单</Button>
    {/if}
  </div>
</div>

{#if notice}
  <div role="status" class="mb-4 rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm font-bold text-teal-800 shadow">{notice}</div>
{/if}

{#if activeSheet}
  <!-- 抽检进度 -->
  <section class="mb-4 rounded-2xl border bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="font-black">{activeSheet.title}</h2>
        <p class="text-xs text-slate-500">
          建单 {formatDateTime(activeSheet.createdAt)}
          {#if activeSheet.finishedAt} · 结束 {formatDateTime(activeSheet.finishedAt)}{/if}
        </p>
      </div>
      {#if !activeSheet.finishedAt}
        <div class="flex items-center gap-2">
          <Button size="sm" color="light" on:click={appendMore}>追加新确认段落</Button>
          <Button size="sm" color={confirmFinish ? 'red' : 'yellow'} on:click={tryFinish}>
            {confirmFinish ? '再次点击确认结束' : '全部确认并结束'}
          </Button>
        </div>
      {:else}
        <div class="flex items-center gap-2">
          {#if open && open.id !== activeSheet.id}
            <Button size="sm" color="blue" on:click={() => (selectedSheetId = null)}>返回进行中的抽检单</Button>
          {/if}
          <span class="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">已结束 · 已锁定</span>
        </div>
      {/if}
    </div>
    {#if !activeSheet.finishedAt}
      <div class="mt-3">
        <div class="flex justify-between text-[11px] font-bold text-slate-500">
          <span>完成进度 {doneCount} / {activeSheet.items.length}</span>
          <span>{activeSheet.items.filter(i => i.state === 'pending').length} 段待检</span>
        </div>
        <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-teal-600 transition-all" style={`width:${activeSheet.items.length ? (doneCount / activeSheet.items.length) * 100 : 0}%`}></div>
        </div>
      </div>
    {/if}
  </section>

  <!-- 按发言人汇总（结束后生成，进行中为预览） -->
  <section class="mb-4 rounded-2xl border bg-white p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="font-black">发言人汇总</h2>
      <span class="text-[11px] text-slate-500">{activeSheet.finishedAt ? '最终结果' : '实时预览 · 结束后锁定'}</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[640px] text-left text-xs">
        <thead class="uppercase tracking-wider text-slate-500">
          <tr>
            <th class="p-2">发言人</th><th class="p-2">抽检数</th><th class="p-2">问题数</th>
            <th class="p-2">漏译</th><th class="p-2">术语</th><th class="p-2">数字</th><th class="p-2">表达</th>
            <th class="p-2">平均分</th>
          </tr>
        </thead>
        <tbody>
          {#each stats as row}
            <tr class="border-t">
              <td class="p-2 font-bold">{speakerName($desk, row.speakerId)}</td>
              <td class="p-2">{row.total}</td>
              <td class="p-2"><span class="rounded-md px-2 py-0.5 font-bold {row.problemCount ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}">{row.problemCount}</span></td>
              <td class="p-2">{row.issueCounts.omission || '—'}</td>
              <td class="p-2">{row.issueCounts.terminology || '—'}</td>
              <td class="p-2">{row.issueCounts.number || '—'}</td>
              <td class="p-2">{row.issueCounts.expression || '—'}</td>
              <td class="p-2"><span class="rounded-md border px-2 py-0.5 font-black {scoreClass(row.averageScore)}">{row.averageScore.toFixed(1)}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <!-- 逐段抽检明细 -->
  {#if expanded}
    <section class="space-y-3">
      {#each activeSheet.items as item, index}
        {@const cue = $desk.cues.find(c => c.id === item.cueId)}
        <article class="rounded-2xl border bg-white p-4 shadow-sm {item.state === 'pending' ? 'border-slate-300' : 'border-slate-200'}">
          <div class="flex flex-wrap items-start gap-3">
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-black text-white">{index + 1}</span>
            <div class="min-w-0 flex-1">
              <div class="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span class="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{speakerName($desk, item.speakerId)}</span>
                <span class="rounded-md border border-slate-200 px-2 py-1 text-slate-500">{formatTime(item.receivedAt)}</span>
                <span class="rounded-md px-2 py-1 {stateClass(item)}">{stateLabel(item)}</span>
                {#if item.score}<span class="rounded-md border px-2 py-1 {scoreClass(item.score)}">{item.score} 分</span>{/if}
                {#each item.issues as issue}<span class="rounded-md bg-red-100 px-2 py-1 text-red-800">{issueLabel(issue)}</span>{/each}
              </div>

              <!-- 原稿回看 -->
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">原稿（播出留档）</span>
                <p class="mt-1 text-sm leading-6">{item.originalText}</p>
              </div>

              <!-- 舞台当前采用版本 -->
              {#if cue && stageText(cue) !== item.originalText}
                <div class="mt-2 rounded-xl border border-teal-200 bg-teal-50 p-3">
                  <span class="text-[10px] font-black uppercase tracking-wider text-teal-700">舞台现采用修正稿</span>
                  <p class="mt-1 text-sm font-bold leading-6 text-teal-900">{stageText(cue)}</p>
                </div>
              {/if}

              {#if item.state !== 'pending'}
                {#if item.state === 'issue'}
                  <div class="mt-2 grid gap-2 md:grid-cols-2">
                    <div class="rounded-xl border border-red-200 bg-red-50 p-3">
                      <span class="text-[10px] font-black uppercase tracking-wider text-red-700">修正稿</span>
                      <p class="mt-1 text-sm leading-6 text-red-900">{item.revision}</p>
                    </div>
                    <div class="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <span class="text-[10px] font-black uppercase tracking-wider text-amber-700">问题原因</span>
                      <p class="mt-1 text-sm leading-6 text-amber-900">{item.reason}</p>
                    </div>
                  </div>
                  <p class="mt-2 text-[10px] text-slate-400">确认于 {item.reviewedAt ? formatDateTime(item.reviewedAt) : '—'}</p>
                {/if}
                {#if !activeSheet.finishedAt}
                  <Button class="mt-3" size="xs" color="light" on:click={() => resetItem(item)}>退回待检重评</Button>
                {/if}
              {:else if !activeSheet.finishedAt}
                <!-- 评分与问题勾选 -->
                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <span class="text-[11px] font-black text-slate-500">问题类型</span>
                  {#each ISSUE_TYPES as type}
                    <button
                      type="button"
                      class="focus-ring rounded-full border px-3 py-1 text-xs font-bold transition {item.issues.includes(type.id) ? 'border-red-400 bg-red-100 text-red-800' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}"
                      title={type.hint}
                      aria-pressed={item.issues.includes(type.id)}
                      on:click={() => toggleIssue(item, type.id)}
                    >
                      {type.label}
                    </button>
                  {/each}
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <span class="text-[11px] font-black text-slate-500">评分（1 差 – 5 优）</span>
                  {#each [1, 2, 3, 4, 5] as score}
                    <button
                      type="button"
                      class="focus-ring h-9 w-9 rounded-lg border text-sm font-black transition {item.score === score ? scoreClass(score) + ' border-2' : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'}"
                      aria-pressed={item.score === score}
                      on:click={() => setScore(item, score)}
                    >
                      {score}
                    </button>
                  {/each}
                </div>

                <!-- 有问题才需要修正稿与原因 -->
                {#if item.issues.length}
                  <div class="mt-3 grid gap-3 md:grid-cols-2">
                    <label class="block">
                      <span class="text-[11px] font-black text-slate-500">修正稿 <span class="text-red-600">*</span></span>
                      <textarea
                        class="focus-ring mt-1 w-full rounded-xl border p-3 text-sm" rows="3"
                        placeholder="保存后舞台改用此修正稿…"
                        value={item.revision}
                        on:change={e => saveReviewDraft(activeSheet.id, item.id, { revision: (e.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </label>
                    <label class="block">
                      <span class="text-[11px] font-black text-slate-500">问题原因 <span class="text-red-600">*</span></span>
                      <textarea
                        class="focus-ring mt-1 w-full rounded-xl border p-3 text-sm" rows="3"
                        placeholder="如：漏译冷却走廊定义；数字 8% 误作 18%…"
                        value={item.reason}
                        on:change={e => saveReviewDraft(activeSheet.id, item.id, { reason: (e.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </label>
                  </div>
                {/if}

                <div class="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" color="green" disabled={!item.score} on:click={() => confirmItem(item, false)}>确认无问题</Button>
                  <Button size="sm" color="red" disabled={!item.issues.length} on:click={() => confirmItem(item, true)}>保存返修并采用修正稿</Button>
                  {#if !item.score}<span class="self-center text-[11px] text-slate-400">先打分才能确认</span>{/if}
                </div>
              {/if}
            </div>
          </div>
        </article>
      {/each}
    </section>
  {/if}

  {#if sheetList.length > 1}
    <section class="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-black">其他抽检单</h2>
      <div class="grid gap-2 sm:grid-cols-2">
        {#each sheetList.filter(s => s.id !== activeSheet.id) as sheet}
          <button type="button" class="focus-ring rounded-xl border border-slate-200 p-3 text-left hover:border-teal-400" on:click={() => (selectedSheetId = sheet.id, expanded = true)}>
            <div class="flex items-center justify-between gap-2">
              <strong class="truncate text-xs">{sheet.title}</strong>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold {sheet.finishedAt ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}">
                {sheet.finishedAt ? '已结束' : '进行中'}
              </span>
            </div>
            <p class="mt-1 text-[11px] text-slate-500">{formatDateTime(sheet.createdAt)} · {sheet.items.length} 段 · {sheet.items.filter(i => i.state === 'issue').length} 段返修</p>
          </button>
        {/each}
      </div>
    </section>
  {/if}
{:else}
  <!-- 无打开的抽检单 -->
  <div class="grid gap-4 xl:grid-cols-[1fr_1fr]">
    <section class="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-100 text-2xl text-teal-700">📋</div>
      <h2 class="mt-3 font-black">建立本场抽检单</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-slate-500">
        抽检单从本场已确认段落建立。当前有 <strong class="text-teal-700">{eligible.length}</strong> 个可抽检段落。
        逐段勾选漏译、术语、数字或表达问题并打分；没问题的段落也要确认，全部确认后方可结束。
      </p>
      <Button class="mt-4" color="green" disabled={!eligible.length} on:click={startSheet}>
        {eligible.length ? '从已确认段落建抽检单' : '暂无可抽检段落'}
      </Button>
      {#if !eligible.length}
        <p class="mt-2 text-[11px] text-slate-400">请先在「现场传译」确认段落，或等待未结束单完成。</p>
      {/if}
    </section>

    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-black">历史抽检单</h2>
      {#if sheetList.length}
        <div class="space-y-2">
          {#each sheetList as sheet}
            {@const row = speakerReviewStats(sheet)[0]}
            <button type="button" class="focus-ring w-full rounded-xl border border-slate-200 p-3 text-left hover:border-teal-400" on:click={() => (selectedSheetId = sheet.id, expanded = true)}>
              <div class="flex items-center justify-between gap-2">
                <strong class="text-sm">{sheet.title}</strong>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-bold {sheet.finishedAt ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}">
                  {sheet.finishedAt ? '已结束' : '进行中'}
                </span>
              </div>
              <p class="mt-1 text-[11px] text-slate-500">{formatDateTime(sheet.createdAt)} · {sheet.items.length} 段 · {sheet.items.filter(i => i.state === 'issue').length} 段返修</p>
            </button>
          {/each}
        </div>
      {:else}
        <p class="py-8 text-center text-xs text-slate-400">还没有抽检单。结束后可在此回看按发言人汇总。</p>
      {/if}
    </section>
  </div>
{/if}

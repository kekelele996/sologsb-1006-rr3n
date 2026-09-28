<script lang="ts">
  import Button from 'flowbite-svelte/Button.svelte'
  import {
    createInspectionSheet, desk, finishInspectionSheet, formatIssueType, inspectionSummary,
    reopenInspectionSheet, saveInspectionItem, speakerName
  } from './store'
  import type { InspectionIssue, InspectionSheet } from './types'

  const issueOptions: Array<[InspectionIssue, string, string]> = [
    ['omission', '漏译', '缺漏信息或整句未译'],
    ['terminology', '术语', '与指定译法不一致'],
    ['number', '数字', '数字、日期或单位有误'],
    ['expression', '表达', '语病、歧义或不得体']
  ]

  let activeSheetId: string | null = null
  let selectedCueId = ''
  let notice = ''

  type Draft = { score: number; issueTypes: InspectionIssue[]; revision: string; reason: string }
  const drafts = new Map<string, Draft>()

  $: openSheet = $desk.inspectionSheets.find(sheet => sheet.finishedAt === null)
  $: activeSheet = openSheet
    || $desk.inspectionSheets.find(sheet => sheet.id === activeSheetId)
    || $desk.inspectionSheets[0]
    || null
  $: if (openSheet) activeSheetId = openSheet.id
  $: takenCueIds = new Set($desk.inspectionSheets.flatMap(sheet => sheet.items.map(item => item.cueId)))
  $: eligibleCues = $desk.cues.filter(cue => cue.status === 'confirmed' && !takenCueIds.has(cue.id))
  $: stats = activeSheet ? inspectionSummary(activeSheet) : []
  $: checkedCount = activeSheet?.items.filter(item => item.checked).length || 0
  $: if (activeSheet && (!selectedCueId || !activeSheet.items.some(item => item.cueId === selectedCueId))) {
    selectedCueId = activeSheet.items.find(item => !item.checked)?.cueId || activeSheet.items[0]?.cueId || ''
  }
  $: selectedItem = activeSheet?.items.find(item => item.cueId === selectedCueId)
    || activeSheet?.items.find(item => !item.checked)
    || activeSheet?.items[0]

  function draftKey(sheetId: string, cueId: string) { return `${sheetId}:${cueId}` }
  function draftFor(sheetId: string, cueId: string): Draft {
    const key = draftKey(sheetId, cueId)
    let draft = drafts.get(key)
    if (!draft) {
      const item = activeSheet?.items.find(row => row.cueId === cueId)
      draft = {
        score: item?.score || 0,
        issueTypes: item ? [...item.issueTypes] : [],
        revision: item?.revision || '',
        reason: item?.reason || ''
      }
      drafts.set(key, draft)
    }
    return draft
  }
  function cueById(id: string) { return $desk.cues.find(cue => cue.id === id) }
  function toggleIssue(draft: Draft, type: InspectionIssue) {
    draft.issueTypes = draft.issueTypes.includes(type)
      ? draft.issueTypes.filter(item => item !== type)
      : [...draft.issueTypes, type]
  }
  function startSheet() {
    const id = createInspectionSheet()
    if (id) { activeSheetId = id; selectedCueId = ''; flash('已按本场已确认段落建立抽检单。') }
  }
  function saveCurrent() {
    if (!activeSheet || !selectedItem) return
    const draft = drafts.get(draftKey(activeSheet.id, selectedItem.cueId))
    if (!draft) return
    if (draft.score < 1 || draft.score > 5) { flash('请先为本段打出 1 到 5 分。'); return }
    if (draft.issueTypes.length && (!draft.revision.trim() || !draft.reason.trim())) {
      flash('有问题的段落必须填写修正稿和问题原因。'); return
    }
    saveInspectionItem(activeSheet.id, selectedItem.cueId, draft)
    const next = activeSheet.items.find(item => !item.checked && item.cueId !== selectedItem.cueId)
    if (next) selectedCueId = next.cueId
    flash(draft.issueTypes.length ? '抽检结果已保存，舞台改用修正稿，原稿仍可回看。' : '本段确认无问题。')
  }
  function finishSheet() {
    if (!activeSheet) return
    if (finishInspectionSheet(activeSheet.id)) flash('全部段落已确认，抽检单已结束。')
    else flash('还有段落未确认，不能结束抽检单。')
  }
  function reopen(sheet: InspectionSheet) {
    reopenInspectionSheet(sheet.id)
    activeSheetId = sheet.id
    flash('抽检单已重新打开，可继续返修。')
  }
  function flash(message: string) {
    notice = message
    window.setTimeout(() => { if (notice === message) notice = '' }, 3200)
  }
  function scoreLabel(score: number) {
    return ['', '问题严重', '明显问题', '可用但需改', '基本准确', '优秀准确'][score] || ''
  }
  function formatTime(timestamp: number) {
    return timestamp ? new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : ''
  }
</script>

{#if notice}<div role="status" class="fixed right-5 top-20 z-50 rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm font-bold text-teal-800 shadow-2xl">{notice}</div>{/if}

<div class="mb-5">
  <p class="text-[10px] font-black uppercase tracking-[.18em] text-teal-700">播出质量抽检 · 返修依据留档</p>
  <h1 class="mt-1 text-3xl font-black">抽检单与段落返修</h1>
  <p class="mt-2 text-sm text-slate-500">从本场已确认段落建单；逐段评分、勾问题并填写修正稿，保存后舞台切换为修正稿，原稿保留可回看。全部段落确认后才能结束。</p>
</div>

{#if !activeSheet}
  <section class="rounded-2xl border bg-white p-6 shadow-sm">
    <div class="grid gap-4 md:grid-cols-2 md:items-center">
      <div>
        <h2 class="text-lg font-black">尚无抽检单</h2>
        <p class="mt-2 text-sm text-slate-500">可建单段落：本场状态为“已确认”、且未出现在任何抽检单中的段落，共 <strong class="text-teal-700">{eligibleCues.length}</strong> 条。</p>
        <p class="mt-1 text-xs text-slate-400">一张抽检单结束前，同一段不会再次进入抽检。</p>
      </div>
      <div class="flex md:justify-end"><Button size="lg" color="green" disabled={!eligibleCues.length || Boolean(openSheet)} on:click={startSheet}>从本场已确认段落建单</Button></div>
    </div>
    {#if !eligibleCues.length}<p class="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">暂无可抽检段落：请先在“现场传译”确认段落，或等待新的已确认内容。</p>{/if}
  </section>
{:else}
  <div class="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,.8fr)]">
    <div class="space-y-4">
      <section class="rounded-2xl border bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-black">{activeSheet.sessionTitle}</h2>
              {#if activeSheet.finishedAt}
                <span class="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black text-slate-600">已结束 · {formatTime(activeSheet.finishedAt)}</span>
              {:else}
                <span class="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800">进行中</span>
              {/if}
            </div>
            <p class="mt-1 text-xs text-slate-500">建单 {formatTime(activeSheet.createdAt)} · 共 {activeSheet.items.length} 段 · 已确认 {checkedCount} 段</p>
          </div>
          {#if !activeSheet.finishedAt}
            <Button color="green" disabled={checkedCount < activeSheet.items.length} on:click={finishSheet}>全部确认，结束抽检单</Button>
          {:else}
            <Button color="light" disabled={openSheet !== undefined && openSheet.id !== activeSheet.id} on:click={() => reopen(activeSheet)}>重开继续</Button>
          {/if}
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-teal-600 transition-all" style={`width:${activeSheet.items.length ? (checkedCount / activeSheet.items.length) * 100 : 0}%`}></div>
        </div>
      </section>

      {#if selectedItem && activeSheet}
        {@const cue = cueById(selectedItem.cueId)}
        {@const draft = draftFor(activeSheet.id, selectedItem.cueId)}
        <section class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="flex flex-wrap items-center gap-2 text-[10px] font-bold">
            <span class="rounded-md bg-slate-900 px-2 py-1 text-white">{speakerName($desk, selectedItem.speakerId)}</span>
            {#if cue}
              <span class="rounded-md border border-slate-200 px-2 py-1 text-slate-500">现场接入 {new Date(cue.receivedAt).toLocaleTimeString('zh-CN', { hour12: false })}</span>
            {/if}
            {#if selectedItem.checked}
              <span class="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">{selectedItem.hasIssue ? '已返修' : '已确认无问题'}</span>
            {:else}
              <span class="rounded-md bg-blue-100 px-2 py-1 text-blue-800">待抽检</span>
            {/if}
          </div>

          {#if cue}
            <div class="mt-3 rounded-xl border border-teal-200 bg-teal-50/70 p-3">
              <div class="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-teal-700">
                <span>{cue.revised ? '舞台当前使用 · 修正稿' : '舞台当前字幕'}</span>
                {#if cue.revised}<span class="rounded bg-teal-700 px-1.5 py-0.5 text-white">已切换修正稿</span>{/if}
              </div>
              <p class="mt-2 text-base font-bold leading-7 text-ink">{cue.text}</p>
            </div>
            {#if cue.revised && cue.originalText}
              <details class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <summary class="cursor-pointer text-xs font-black text-slate-600">回看播出原稿</summary>
                <p class="mt-2 leading-6 text-slate-500 line-through decoration-slate-300">{cue.originalText}</p>
              </details>
            {/if}
          {/if}

          {#if !activeSheet.finishedAt}
            <fieldset class="mt-4">
              <legend class="text-[10px] font-black uppercase tracking-wider text-slate-500">问题类型（可多选；不勾即无问题）</legend>
              <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {#each issueOptions as [type, label, hint]}
                  <label class="cursor-pointer rounded-xl border p-3 text-center transition {draft.issueTypes.includes(type) ? 'border-red-400 bg-red-50 ring-2 ring-red-200' : 'border-slate-200 hover:border-slate-300'}">
                    <input type="checkbox" class="sr-only" checked={draft.issueTypes.includes(type)} on:change={() => toggleIssue(draft, type)} />
                    <span class="block text-sm font-black text-ink">{label}</span>
                    <span class="mt-1 block text-[10px] leading-4 text-slate-500">{hint}</span>
                  </label>
                {/each}
              </div>
            </fieldset>

            <fieldset class="mt-4">
              <legend class="text-[10px] font-black uppercase tracking-wider text-slate-500">评分（1 到 5 分）</legend>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                {#each [1, 2, 3, 4, 5] as score}
                  <button type="button" class="focus-ring h-11 w-11 rounded-xl border-2 text-sm font-black transition {draft.score === score ? score >= 4 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : score === 3 ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}" on:click={() => draft.score = score}>{score}</button>
                {/each}
                {#if draft.score > 0}<span class="ml-1 text-xs font-bold text-slate-600">{scoreLabel(draft.score)}</span>{/if}
              </div>
            </fieldset>

            {#if draft.issueTypes.length > 0}
              <label class="mt-4 block text-[10px] font-black uppercase tracking-wider text-slate-500">修正稿（保存后舞台改用此稿）
                <textarea class="focus-ring mt-2 w-full rounded-xl border border-slate-300 p-3 text-base leading-7" rows="3" bind:value={draft.revision} placeholder="输入可直接上舞台的修正译文…"></textarea>
              </label>
              <label class="mt-3 block text-[10px] font-black uppercase tracking-wider text-slate-500">问题原因 / 返修依据
                <textarea class="focus-ring mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" rows="2" bind:value={draft.reason} placeholder="例如：漏译后半句数据来源；术语应为“韧性”…"></textarea>
              </label>
            {/if}

            <div class="mt-4 flex flex-wrap gap-2">
              <Button color="green" on:click={saveCurrent}>{selectedItem.checked ? '更新本段抽检结果' : '保存本段并继续下一段'}</Button>
              {#if draft.issueTypes.length === 0 && draft.score > 0}<span class="self-center text-xs text-slate-500">未勾问题将按“确认无问题”保存，仍需给出评分。</span>{/if}
            </div>
          {:else}
            <div class="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-black">评分 {selectedItem.score} / 5</span>
                {#if selectedItem.hasIssue}
                  {#each selectedItem.issueTypes as type}<span class="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-800">{formatIssueType(type)}</span>{/each}
                {:else}
                  <span class="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">无问题</span>
                {/if}
              </div>
              {#if selectedItem.hasIssue}
                <p class="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">返修依据</p>
                <p class="mt-1 leading-6 text-slate-700">{selectedItem.reason}</p>
              {/if}
            </div>
          {/if}
        </section>
      {/if}
    </div>

    <div class="space-y-4">
      <section class="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 class="font-black">段落清单</h2>
        <div class="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
          {#each activeSheet.items as item, index}
            {@const cue = cueById(item.cueId)}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <button type="button" class="w-full rounded-xl border p-3 text-left transition {item.cueId === selectedItem?.cueId ? 'border-teal-600 bg-teal-50' : item.checked ? 'border-slate-200 bg-white' : 'border-dashed border-amber-300 bg-amber-50/50'}" on:click={() => selectedCueId = item.cueId}>
              <div class="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500">
                <span>第 {index + 1} 段 · {speakerName($desk, item.speakerId)}</span>
                {#if item.checked}<span class="rounded-full px-2 py-0.5 {item.hasIssue ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}">{item.hasIssue ? `${item.score}分·返修` : `${item.score}分`}</span>{:else}<span class="rounded-full bg-amber-200 px-2 py-0.5 text-amber-900">待检</span>{/if}
              </div>
              <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{cue?.text || '段落已删除'}</p>
              {#if item.checked && item.hasIssue}
                <p class="mt-1 text-[10px] text-red-700">{#each item.issueTypes as type, i}{#if i > 0}、{/if}{formatIssueType(type)}{/each}</p>
              {/if}
            </button>
          {/each}
        </div>
      </section>

      <section class="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 class="font-black">按发言人汇总</h2>
        <div class="mt-3 space-y-2">
          {#each stats as row}
            <div class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span class="font-bold">{speakerName($desk, row.speakerId)}</span>
              <span class="text-xs text-slate-600">抽检 <strong>{row.inspected}</strong> · 问题 <strong class:!text-red-700={row.issues > 0}>{row.issues}</strong> · 平均 <strong>{row.average}</strong></span>
            </div>
          {/each}
          {#if !stats.length}<p class="py-3 text-center text-xs text-slate-400">确认段落后生成汇总。</p>{/if}
        </div>
        {#if activeSheet.finishedAt}<p class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">抽检单已结束；如需返修可重开，进度和评分都会保留。</p>{/if}
      </section>

      {#if $desk.inspectionSheets.length > 1}
        <section class="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 class="font-black">历史抽检单</h2>
          <div class="mt-3 space-y-2">
            {#each $desk.inspectionSheets.filter(sheet => sheet.id !== activeSheet.id) as sheet}
              <button type="button" class="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-xs hover:border-slate-300" on:click={() => activeSheetId = sheet.id}>
                <span class="font-bold">{sheet.sessionTitle}<span class="ml-2 font-normal text-slate-400">{sheet.items.length} 段</span></span>
                <span class="{sheet.finishedAt ? 'text-slate-400' : 'text-amber-700'}">{sheet.finishedAt ? '已结束' : '进行中'}</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  </div>
{/if}

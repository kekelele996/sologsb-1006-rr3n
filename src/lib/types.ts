export type CueStatus = 'pending' | 'confirmed' | 'followup'
export type TabId = 'live' | 'backstage' | 'terms' | 'offline' | 'qa'
export type IssueType = 'omission' | 'terminology' | 'number' | 'expression'
export type ReviewItemState = 'pending' | 'ok' | 'issue'

export interface Speaker {
  id: string
  name: string
  title: string
  language: string
  color: string
}

export interface Session {
  id: string
  order: number
  time: string
  title: string
  speakerId: string
  room: string
  status: 'upcoming' | 'live' | 'done'
}

export interface Term {
  id: string
  source: string
  target: string
  note: string
  speakerId: string
  priority: 'normal' | 'high'
}

export interface Announcement {
  id: string
  level: 'info' | 'warning' | 'urgent'
  text: string
  visibleOnStage: boolean
  createdAt: string
}

export interface Cue {
  id: string
  speakerId: string
  text: string
  receivedAt: number
  status: CueStatus
  manual: boolean
  offline: boolean
  delaySeconds: number
  duplicateOf: string | null
  followupText: string
  tags: string[]
  // 抽检返修：舞台改用修正稿，text 始终保留原稿
  revisedText: string
}

export interface ReviewItem {
  id: string
  cueId: string
  speakerId: string
  // 建单时的原文快照，原稿随时可回看
  originalText: string
  receivedAt: number
  state: ReviewItemState
  issues: IssueType[]
  score: number
  revision: string
  reason: string
  reviewedAt: string
}

export interface ReviewSheet {
  id: string
  title: string
  sessionId: string
  speakerIds: string[]
  createdAt: string
  finishedAt: string | null
  items: ReviewItem[]
}

export interface SpeakerReviewStats {
  speakerId: string
  total: number
  problemCount: number
  issueCounts: Record<IssueType, number>
  averageScore: number
}

export interface Reminder {
  id: string
  termId: string
  cueId: string
  target: string
  createdAt: number
  acknowledged: boolean
}

export interface DeskState {
  speakers: Speaker[]
  sessions: Session[]
  terms: Term[]
  announcements: Announcement[]
  cues: Cue[]
  reminders: Reminder[]
  reviewSheets: ReviewSheet[]
  activeCueId: string
  fontScale: number
  online: boolean
  liveSimulation: boolean
  updatedAt: string
}

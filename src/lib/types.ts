export type CueStatus = 'pending' | 'confirmed' | 'followup'
export type TabId = 'live' | 'qa' | 'backstage' | 'terms' | 'offline'
export type InspectionIssue = 'omission' | 'terminology' | 'number' | 'expression'

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
  originalText: string
  revised: boolean
  receivedAt: number
  status: CueStatus
  manual: boolean
  offline: boolean
  delaySeconds: number
  duplicateOf: string | null
  followupText: string
  tags: string[]
}

export interface Reminder {
  id: string
  termId: string
  cueId: string
  target: string
  createdAt: number
  acknowledged: boolean
}

export interface InspectionItem {
  cueId: string
  speakerId: string
  score: number
  issueTypes: InspectionIssue[]
  revision: string
  reason: string
  checked: boolean
  hasIssue: boolean
  updatedAt: number
}

export interface InspectionSheet {
  id: string
  sessionTitle: string
  createdAt: number
  finishedAt: number | null
  items: InspectionItem[]
}

export interface DeskState {
  speakers: Speaker[]
  sessions: Session[]
  terms: Term[]
  announcements: Announcement[]
  cues: Cue[]
  reminders: Reminder[]
  inspectionSheets: InspectionSheet[]
  activeCueId: string
  fontScale: number
  online: boolean
  liveSimulation: boolean
  updatedAt: string
}

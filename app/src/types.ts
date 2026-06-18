export type CharacterType = 'investigator' | 'npc' | 'creature'

export type SkillKey = string

export type SkillAllocation = {
  key: SkillKey
  label: string
  category: string
  base: number
  occupationAdded: number
  interestAdded: number
  final: number
  isOccupation: boolean
  forcedOccupation?: boolean
}

export type CreationAudit = {
  source: string
  checkedAt: string
  missing: string[]
  warnings: string[]
}

export type CharacterSheetExtras = {
  era?: string
  creditRatingRange?: string
  cash?: string
  assets?: string
  spendingLevel?: string
  equipment?: string
  weapons?: string
  armor?: string
  portraitNote?: string
}

export type Character = {
  id: string
  name: string
  player?: string
  type: CharacterType
  role: string
  age?: number
  sex?: string
  residence?: string
  birthplace?: string
  characteristics?: {
    str: number
    con: number
    siz: number
    dex: number
    app: number
    int: number
    pow: number
    edu: number
  }
  hp: number
  hpMax: number
  san: number
  sanMax: number
  mp: number
  luck: number
  dex: number
  mov?: number
  build?: number
  damageBonus?: string
  occupationPoints?: number
  personalInterestPoints?: number
  skills: Partial<Record<SkillKey, number>>
  skillBreakdown?: SkillAllocation[]
  creationAudit?: CreationAudit
  sheetExtras?: CharacterSheetExtras
  conditions: string[]
  backstory?: {
    ideology: string
    significantPeople: string
    meaningfulLocations: string
    treasuredPossessions: string
    traits: string
    darkSecret?: string
    injuriesScars: string
    phobiasManias: string
    personalDescription: string
    investigatorExperiences?: string
    mythosEncounters?: string
    spells?: string
    allies?: string
  }
  privateNotes?: string
}

export type Scene = {
  id: string
  title: string
  location: string
  summary: string
  pressure: string
  sourceRef: string
}

export type ClueStatus = 'hidden' | 'available' | 'revealed'

export type Clue = {
  id: string
  title: string
  content: string
  status: ClueStatus
  sceneId: string
  relatedNpcIds: string[]
  revealHint: string
}

export type ProgressClock = {
  id: string
  title: string
  current: number
  max: number
  consequence: string
}

export type LogEntry = {
  id: string
  time: string
  type: 'player_action' | 'keeper_ruling' | 'roll' | 'state_change'
  content: string
  confirmed: boolean
}

export type SourceRef = {
  label: string
  path: string
}

export type CheckSuggestion = {
  id: string
  skill: SkillKey
  label: string
  targetCharacterId: string
  difficulty: 'regular' | 'hard' | 'extreme'
  reason: string
}

export type ProposedChange = {
  id: string
  label: string
  detail: string
  kind: 'reveal_clue' | 'advance_clock' | 'add_log'
  targetId?: string
}

export type AssistantSuggestion = {
  id: string
  situationSummary: string
  nextMoves: string[]
  checks: CheckSuggestion[]
  clueTriggers: string[]
  npcReactions: string[]
  riskWarnings: string[]
  proposedChanges: ProposedChange[]
  sources: SourceRef[]
}

export type RollResult = {
  id: string
  characterId: string
  skill: SkillKey
  target: number
  difficulty: 'regular' | 'hard' | 'extreme'
  bonusPenalty: number
  ones: number
  tensCandidates: number[]
  selectedTens: number
  roll: number
  successLevel: 'critical' | 'extreme' | 'hard' | 'regular' | 'failure' | 'fumble'
  successRank: number
  luckToRegular?: number
  luckToHard?: number
  luckToExtreme?: number
  createdAt: string
}

export type CampaignState = {
  campaignName: string
  moduleName: string
  currentSceneId: string
  characters: Character[]
  scenes: Scene[]
  clues: Clue[]
  clocks: ProgressClock[]
  logs: LogEntry[]
  suggestions: AssistantSuggestion[]
  rolls: RollResult[]
  storyGraph?: {
    nodeStatuses: Record<string, string>
    clueStates: Record<string, string>
  }
}

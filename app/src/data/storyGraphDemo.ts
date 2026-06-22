import moduleTemplate from '../../server/data/kp-agent/liaoque_huanmeng/module_template.json'

export type StoryNodeStatus = 'locked' | 'available' | 'active' | 'completed' | 'danger' | 'optional' | 'unavailable'
export type StoryClueState = 'hidden' | 'available' | 'revealed' | 'understood' | 'missed'

export type StoryClue = {
  title: string
  playerText: string
  keeperText: string
}

export type StoryNode = {
  id: string
  title: string
  kind: 'intro' | 'investigation' | 'research' | 'social' | 'search' | 'combat' | 'finale' | 'event'
  phase: string
  location: string
  x?: number
  y?: number
  summary: string
  keyPlot: string[]
  clues: StoryClue[]
  rewards: string[]
  risks: string[]
  npcs: string[]
  checks: string[]
  materials: string[]
  keeperNote: string
}

export type StoryEdge = {
  from: string
  to: string
  label: string
  strength: 'main' | 'alternate' | 'optional' | 'danger'
}

export type InvestigatorTrack = {
  id: string
  fallbackName: string
  role: string
  locationNodeId: string
  hp: string
  san: string
  mp: string
  conditions: string[]
  carried: string[]
  lastAction: string
}

export type ModuleClock = {
  title: string
  current: number
  max: number
  consequence: string
}

type StoryGraphState = {
  nodeStatuses: Record<string, StoryNodeStatus>
  clueStates: Record<string, StoryClueState>
}

type ModuleTemplate = {
  frontendGraph: {
    storyNodes: StoryNode[]
    storyEdges: StoryEdge[]
    investigatorTracks: InvestigatorTrack[]
    moduleClocks: ModuleClock[]
    completedBeats: string[]
    initialStoryGraphState?: StoryGraphState
  }
}

const frontendGraph = (moduleTemplate as unknown as ModuleTemplate).frontendGraph

export const storyNodes: StoryNode[] = frontendGraph.storyNodes
export const storyEdges: StoryEdge[] = frontendGraph.storyEdges
export const investigatorTracks: InvestigatorTrack[] = frontendGraph.investigatorTracks
export const moduleClocks: ModuleClock[] = frontendGraph.moduleClocks
export const completedBeats: string[] = frontendGraph.completedBeats

const fallbackInitialStoryGraphState: StoryGraphState = {
  nodeStatuses: Object.fromEntries(
    storyNodes.map((node, index) => [node.id, index === 0 ? 'active' : 'locked']),
  ) as Record<string, StoryNodeStatus>,
  clueStates: Object.fromEntries(
    storyNodes.flatMap((node) => node.clues.map((clue) => [`${node.id}::${clue.title}`, 'hidden'])),
  ) as Record<string, StoryClueState>,
}

export const initialStoryGraphState: StoryGraphState =
  frontendGraph.initialStoryGraphState ?? fallbackInitialStoryGraphState

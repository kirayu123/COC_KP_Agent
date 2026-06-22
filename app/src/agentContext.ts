import { labelForSkill } from './rules/coc7'
import type { CampaignState, Character, LogEntry } from './types'

type AgentSkillSummary = {
  key: string
  label: string
  value: number
}

type AgentCharacterSummary = {
  id: string
  name: string
  player?: string
  type: Character['type']
  role: string
  hp: string
  san: string
  mp: number
  luck: number
  mov?: number
  location: string
  conditions: string[]
  topSkills: AgentSkillSummary[]
  characteristics?: Character['characteristics']
}

export type AgentContext = {
  schemaVersion: 'kp-agent-context-v1'
  generatedAt: string
  campaign: {
    campaignName: string
    moduleName: string
  }
  partySummary: {
    investigatorCount: number
    activeInvestigatorIds: string[]
    investigators: AgentCharacterSummary[]
    removedInvestigators: Array<{
      name: string
      time: string
      logId: string
    }>
  }
  currentScene?: {
    id: string
    title: string
    location: string
    summary: string
    pressure: string
    sourceRef: string
  }
  storyProgress: {
    currentSceneStatus: string
    activeNodeIds: string[]
    completedNodeIds: string[]
    lockedNodeCount: number
    currentSceneClueStates: Array<{ title: string; status: string }>
  }
  currentClues: {
    hiddenCount: number
    available: Array<{ id: string; title: string; sceneId: string; revealHint: string }>
    revealed: Array<{ id: string; title: string; sceneId: string; content: string }>
  }
  clocks: Array<{
    id: string
    title: string
    progress: string
    current: number
    max: number
    consequence: string
  }>
  npcDossiers: AgentCharacterSummary[]
  recentStateChanges: Array<Pick<LogEntry, 'id' | 'time' | 'type' | 'content' | 'confirmed'>>
  recentPlayerActions: Array<Pick<LogEntry, 'id' | 'time' | 'type' | 'content' | 'confirmed' | 'speaker' | 'characterId'>>
  recentRolls: CampaignState['rolls']
  sessionMemory: {
    shortTermTranscript: Array<Pick<LogEntry, 'id' | 'time' | 'type' | 'content' | 'speaker' | 'characterId'>>
    longTermSummary: {
      knownFacts: string[]
      unresolvedThreads: string[]
      importantDecisions: string[]
    }
  }
  operatorHints: string[]
}

export type ModuleContextPack = {
  schemaVersion: 'kp-module-context-v1'
  strategy: 'full-module' | 'runtime-files'
  moduleId: string
  title: string
  sourceText: {
    path: string
    chars: number
    estimatedTokens: number
    content: string
  }
  structuredNavigation: {
    path: string
    chars: number
    estimatedTokens: number
    outline: unknown
  }
  materialsIndex: {
    path: string
    chars: number
    estimatedTokens: number
    content: string
  }
  usagePolicy: string[]
}

export type KpAgentContextBundle = {
  schemaVersion: 'kp-agent-request-context-v1'
  generatedAt: string
  modelAssumption: {
    provider: 'deepseek'
    model: string
    contextWindowTokens: number
    reservedOutputTokens: number
  }
  budget: {
    strategy: 'runtime-files'
    estimatedInputTokens: number
    estimatedAvailableTokens: number
    estimatedUsagePercent: number
    moduleTokens: number
    agentStateTokens: number
    campaignTokens: number
  }
  assemblyOrder: string[]
  moduleContext: ModuleContextPack
  agentContext: AgentContext
}

const DEEPSEEK_CONTEXT_WINDOW_TOKENS = 1_000_000
const RESERVED_OUTPUT_TOKENS = 1_600
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash'
const liaoqieSourceText = ''
const liaoqieMaterialsIndex = ''
const liaoqieStructuredOutline = JSON.stringify({
  strategy: 'server-runtime-data-and-module-source',
  files: [
    'documents/runtime/liaoque_huanmeng/source_text.md',
    'app/server/data/kp-agent/liaoque_huanmeng/module_state.json',
    'app/server/data/kp-agent/liaoque_huanmeng/investigators/index.json',
    'app/server/data/kp-agent/liaoque_huanmeng/npcs/index.json',
  ],
  note: '前端只发送文件清单和当前团状态；服务器端按本轮请求读取唯一模组原文和后端运行数据。',
})

function estimateTokens(text: string): number {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  const latinChars = text.match(/[A-Za-z0-9]/g)?.length ?? 0
  const otherChars = Math.max(0, text.length - chineseChars - latinChars)
  return Math.ceil(chineseChars * 0.6 + latinChars * 0.3 + otherChars * 0.25)
}

function parseStructuredOutline(): unknown {
  try {
    return JSON.parse(liaoqieStructuredOutline)
  } catch {
    return { parseError: true, raw: liaoqieStructuredOutline }
  }
}

const liaoqieModuleContext: ModuleContextPack = {
  schemaVersion: 'kp-module-context-v1',
  strategy: 'full-module',
  moduleId: 'doors-to-darkness-liao-que-huan-meng',
  title: '了却幻梦',
  sourceText: {
    path: 'documents/runtime/liaoque_huanmeng/source_text.md',
    chars: liaoqieSourceText.length,
    estimatedTokens: estimateTokens(liaoqieSourceText),
    content: liaoqieSourceText,
  },
  structuredNavigation: {
    path: 'app/server/data/kp-agent/liaoque_huanmeng/module_state.json',
    chars: liaoqieStructuredOutline.length,
    estimatedTokens: estimateTokens(liaoqieStructuredOutline),
    outline: parseStructuredOutline(),
  },
  materialsIndex: {
    path: '',
    chars: liaoqieMaterialsIndex.length,
    estimatedTokens: estimateTokens(liaoqieMaterialsIndex),
    content: liaoqieMaterialsIndex,
  },
  usagePolicy: [
    '完整模组全文是当前模组事实的最高优先级来源。',
    '后端运行数据只用于当前场景、线索状态、调查员、NPC 和剧情图谱状态，不能替代模组原文。',
    '回答玩家可见文本时禁止剧透守秘人信息；真相、NPC动机和结局条件只能写入 KP 私密建议。',
    '状态变更只能作为 proposedChanges 提交给 KP 确认，不得直接视为已发生。',
  ],
}

function formatLocation(location: string): string {
  return location
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)[0] ?? location
}

function topSkillsFor(character: Character): AgentSkillSummary[] {
  return Object.entries(character.skills)
    .filter(([, value]) => typeof value === 'number')
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 10)
    .map(([key, value]) => ({
      key,
      label: labelForSkill(key),
      value: value ?? 0,
    }))
}

function summarizeCharacter(character: Character, location: string): AgentCharacterSummary {
  return {
    id: character.id,
    name: character.name,
    player: character.player,
    type: character.type,
    role: character.role,
    hp: `${character.hp}/${character.hpMax}`,
    san: `${character.san}/${character.sanMax}`,
    mp: character.mp,
    luck: character.luck,
    mov: character.mov,
    location,
    conditions: character.conditions,
    topSkills: topSkillsFor(character),
    characteristics: character.characteristics,
  }
}

function deletedInvestigatorLogs(logs: LogEntry[]) {
  return logs
    .map((log) => {
      const match = /^删除调查员：([^。]+)/.exec(log.content)
      return match
        ? {
            name: match[1],
            time: log.time,
            logId: log.id,
          }
        : undefined
    })
    .filter((item): item is { name: string; time: string; logId: string } => Boolean(item))
    .slice(0, 8)
}

function buildSessionMemory(campaign: CampaignState): AgentContext['sessionMemory'] {
  const chronologicalChat = [...campaign.logs]
    .reverse()
    .filter((log) => log.type === 'player_action' || log.type === 'keeper_ruling')
  const revealedClues = campaign.clues.filter((clue) => clue.status === 'revealed')
  const availableClues = campaign.clues.filter((clue) => clue.status === 'available')
  const olderChanges = campaign.logs
    .filter((log) => log.type === 'state_change' || log.type === 'roll')
    .slice(16, 40)
    .map((log) => log.content)

  return {
    shortTermTranscript: chronologicalChat.slice(-24).map((log) => ({
      id: log.id,
      time: log.time,
      type: log.type,
      content: log.content,
      speaker: log.speaker,
      characterId: log.characterId,
    })),
    longTermSummary: {
      knownFacts: revealedClues.map((clue) => `${clue.title}：${clue.content}`).slice(0, 12),
      unresolvedThreads: [
        ...availableClues.map((clue) => `${clue.title}：${clue.revealHint}`),
        ...campaign.clocks.filter((clock) => clock.current < clock.max).map((clock) => `${clock.title}：${clock.current}/${clock.max}`),
      ].slice(0, 12),
      importantDecisions: olderChanges.slice(0, 12),
    },
  }
}

export function buildAgentContext(campaign: CampaignState): AgentContext {
  const currentScene = campaign.scenes.find((scene) => scene.id === campaign.currentSceneId) ?? campaign.scenes[0]
  const currentLocation = currentScene ? formatLocation(currentScene.location) : '未知地点'
  const investigators = campaign.characters.filter((character) => character.type === 'investigator')
  const npcDossiers = campaign.characters.filter((character) => character.type !== 'investigator')
  const recentLogs = campaign.logs.slice(0, 16)
  const nodeStatuses = campaign.storyGraph?.nodeStatuses ?? {}
  const activeNodeIds = Object.entries(nodeStatuses)
    .filter(([, status]) => status === 'active')
    .map(([id]) => id)
  const completedNodeIds = Object.entries(nodeStatuses)
    .filter(([, status]) => status === 'completed')
    .map(([id]) => id)
  const lockedNodeCount = Object.values(nodeStatuses).filter((status) => status === 'locked').length
  const currentSceneClues = currentScene ? campaign.clues.filter((clue) => clue.sceneId === currentScene.id) : []

  return {
    schemaVersion: 'kp-agent-context-v1',
    generatedAt: new Date().toISOString(),
    campaign: {
      campaignName: campaign.campaignName,
      moduleName: campaign.moduleName,
    },
    partySummary: {
      investigatorCount: investigators.length,
      activeInvestigatorIds: investigators.map((character) => character.id),
      investigators: investigators.map((character) => summarizeCharacter(character, currentLocation)),
      removedInvestigators: deletedInvestigatorLogs(campaign.logs),
    },
    currentScene: currentScene
      ? {
          id: currentScene.id,
          title: currentScene.title,
          location: currentLocation,
          summary: currentScene.summary,
          pressure: currentScene.pressure,
          sourceRef: currentScene.sourceRef,
        }
      : undefined,
    storyProgress: {
      currentSceneStatus: currentScene ? nodeStatuses[currentScene.id] ?? 'active' : 'unknown',
      activeNodeIds,
      completedNodeIds,
      lockedNodeCount,
      currentSceneClueStates: currentSceneClues.map((clue) => ({
        title: clue.title,
        status: clue.status,
      })),
    },
    currentClues: {
      hiddenCount: campaign.clues.filter((clue) => clue.status === 'hidden').length,
      available: campaign.clues
        .filter((clue) => clue.status === 'available')
        .map((clue) => ({
          id: clue.id,
          title: clue.title,
          sceneId: clue.sceneId,
          revealHint: clue.revealHint,
        })),
      revealed: campaign.clues
        .filter((clue) => clue.status === 'revealed')
        .map((clue) => ({
          id: clue.id,
          title: clue.title,
          sceneId: clue.sceneId,
          content: clue.content,
        })),
    },
    clocks: campaign.clocks.map((clock) => ({
      id: clock.id,
      title: clock.title,
      progress: `${clock.current}/${clock.max}`,
      current: clock.current,
      max: clock.max,
      consequence: clock.consequence,
    })),
    npcDossiers: npcDossiers.map((character) => summarizeCharacter(character, currentLocation)),
    recentStateChanges: recentLogs
      .filter((log) => log.type === 'state_change' || log.type === 'roll')
      .map((log) => ({
        id: log.id,
        time: log.time,
        type: log.type,
        content: log.content,
        confirmed: log.confirmed,
      })),
    recentPlayerActions: recentLogs
      .filter((log) => log.type === 'player_action' || log.type === 'keeper_ruling')
      .map((log) => ({
        id: log.id,
        time: log.time,
        type: log.type,
        content: log.content,
        confirmed: log.confirmed,
        speaker: log.speaker,
        characterId: log.characterId,
      })),
    recentRolls: campaign.rolls.slice(0, 8),
    sessionMemory: buildSessionMemory(campaign),
    operatorHints: [
      `当前调查员数量：${investigators.length}`,
      '所有建议必须以 partySummary.activeInvestigatorIds 为当前在场调查员来源。',
      '若 recentStateChanges 显示删除、扣血、扣 SAN 或线索变更，后续建议必须承认这些变化。',
      '不要引用已删除调查员作为行动目标或检定目标。',
    ],
  }
}

export function getModuleContextPack(): ModuleContextPack {
  return liaoqieModuleContext
}

export function buildKpAgentContextBundle(campaign: CampaignState, model = DEFAULT_DEEPSEEK_MODEL): KpAgentContextBundle {
  const agentContext = buildAgentContext(campaign)
  const serializedAgentContext = JSON.stringify(agentContext)
  const serializedCampaign = JSON.stringify(campaign)
  const moduleTokens =
    liaoqieModuleContext.sourceText.estimatedTokens +
    liaoqieModuleContext.structuredNavigation.estimatedTokens +
    liaoqieModuleContext.materialsIndex.estimatedTokens
  const agentStateTokens = estimateTokens(serializedAgentContext)
  const campaignTokens = estimateTokens(serializedCampaign)
  const estimatedInputTokens = moduleTokens + agentStateTokens + campaignTokens
  const estimatedAvailableTokens = Math.max(0, DEEPSEEK_CONTEXT_WINDOW_TOKENS - RESERVED_OUTPUT_TOKENS - estimatedInputTokens)

  return {
    schemaVersion: 'kp-agent-request-context-v1',
    generatedAt: new Date().toISOString(),
    modelAssumption: {
      provider: 'deepseek',
      model,
      contextWindowTokens: DEEPSEEK_CONTEXT_WINDOW_TOKENS,
      reservedOutputTokens: RESERVED_OUTPUT_TOKENS,
    },
    budget: {
      strategy: 'runtime-files',
      estimatedInputTokens,
      estimatedAvailableTokens,
      estimatedUsagePercent: Number(((estimatedInputTokens / DEEPSEEK_CONTEXT_WINDOW_TOKENS) * 100).toFixed(2)),
      moduleTokens,
      agentStateTokens,
      campaignTokens,
    },
    assemblyOrder: [
      'system: KP 行为准则与输出格式',
      'moduleContext.sourceText: 完整《了却幻梦》模组原文',
      'moduleContext.structuredNavigation: 场景、线索、NPC、展示材料导航',
      'agentContext: 当前团状态、调查员、NPC、线索、时钟和记忆',
      'campaign: 原始可验证状态快照',
      'keeperRequest: 本次 KP 自然语言请求',
    ],
    moduleContext: liaoqieModuleContext,
    agentContext,
  }
}

export function estimateContextTokens(value: unknown): number {
  return estimateTokens(typeof value === 'string' ? value : JSON.stringify(value))
}

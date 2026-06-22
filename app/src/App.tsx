import { useMemo, useState } from 'react'
import './App.css'
import { buildAgentContext, buildKpAgentContextBundle, estimateContextTokens } from './agentContext'
import { CharacterCreator } from './components/CharacterCreator'
import { DiceAdjudicator } from './components/DiceAdjudicator'
import { StoryGraphDemo } from './components/StoryGraphDemo'
import { demoInvestigators, moduleNpcs, openingSuggestion, seedCampaign } from './data/demo'
import { initialStoryGraphState } from './data/storyGraphDemo'
import { labelForSkill } from './rules/coc7'
import type { KpAgentContextBundle } from './agentContext'
import type { AssistantSuggestion, CampaignState, Character, CheckSuggestion, LogEntry, ProposedChange } from './types'

const STORAGE_KEY = 'coc-kp-agent-demo'
const LEGACY_DEMO_CAMPAIGN_NAMES = new Set(['雾港档案：第一夜', '雾港档案：第一页'])
const LEGACY_DEMO_MODULE_NAMES = new Set(['雨夜档案室'])
const LEGACY_RAINY_SCENE_IDS = new Set(['scene-archive-door', 'scene-reading-room', 'scene-basement'])
const LIAOQIE_CAST_STORAGE_KEY = 'coc-kp-agent-liaoqie-cast-v1'
const LIAOQIE_INITIAL_SCENE_ID = 'scene-resnick-death'
const LIAOQIE_SCENE_DEFAULTS = new Map(seedCampaign.scenes.map((scene) => [scene.id, scene]))
const STALE_OPENING_SUGGESTION_MARKERS = ['屋内的空气', '死者的姿态', '发黑的舌头', '桌边几只不起眼的小玻璃瓶', '拿到了黑色残留物']

type SimulatedPlayerMessage = {
  id?: string
  speaker: string
  characterId?: string
  content: string
  type?: 'player_action'
}

type NormalizeOptions = {
  installDemoCast?: boolean
}

function displayCampaignName(name: string): string {
  const trimmed = name.trim()
  return trimmed && !LEGACY_DEMO_CAMPAIGN_NAMES.has(trimmed) ? trimmed : 'KP 控制台'
}

function displayModuleName(name: string): string {
  const trimmed = name.trim()
  return trimmed && !LEGACY_DEMO_MODULE_NAMES.has(trimmed) ? trimmed : '未加载模组'
}

function displaySceneLocation(location: string): string {
  return location
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)[0] ?? location
}

function isCharacterLike(value: unknown): value is Character {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'name' in value &&
      'skills' in value &&
      typeof (value as Character).skills === 'object',
  )
}

function resetStoryGraphState() {
  return {
    nodeStatuses: { ...initialStoryGraphState.nodeStatuses },
    clueStates: { ...initialStoryGraphState.clueStates },
  }
}

function isLegacyRainyArchiveCampaign(value: Partial<CampaignState>): boolean {
  return Boolean(
    (typeof value.currentSceneId === 'string' && LEGACY_RAINY_SCENE_IDS.has(value.currentSceneId)) ||
      (typeof value.moduleName === 'string' && LEGACY_DEMO_MODULE_NAMES.has(value.moduleName)) ||
      value.scenes?.some((scene) => scene.sourceRef.includes('rainy_archive')),
  )
}

function hasLiaoqieModule(campaign: Partial<CampaignState>): boolean {
  return `${campaign.campaignName ?? ''} ${campaign.moduleName ?? ''}`.includes('了却幻梦')
}

function clampCharacteristic(value: number): number {
  const rounded = Math.round(value / 5) * 5
  return Math.min(90, Math.max(15, rounded))
}

function deriveBuildAndDb(characteristics: NonNullable<Character['characteristics']>): { build: number; damageBonus: string } {
  const sum = characteristics.str + characteristics.siz
  if (sum <= 64) return { build: -2, damageBonus: '-2' }
  if (sum <= 84) return { build: -1, damageBonus: '-1' }
  if (sum <= 124) return { build: 0, damageBonus: '0' }
  if (sum <= 164) return { build: 1, damageBonus: '+1D4' }
  if (sum <= 204) return { build: 2, damageBonus: '+1D6' }
  return { build: 3, damageBonus: '+2D6' }
}

function inferInvestigatorCharacteristics(character: Character): NonNullable<Character['characteristics']> {
  const conAndSiz = clampCharacteristic((character.hpMax || 10) * 5)
  const powFromMp = character.mp ? character.mp * 5 : character.sanMax || 50
  return {
    str: 50,
    con: conAndSiz,
    siz: conAndSiz,
    dex: clampCharacteristic(character.dex || 50),
    app: 50,
    int: 60,
    pow: clampCharacteristic(powFromMp),
    edu: 60,
  }
}

function normalizeCharacterSheet(character: Character): Character {
  if (character.characteristics || character.type !== 'investigator') return character
  const characteristics = inferInvestigatorCharacteristics(character)
  const derivedCombat = deriveBuildAndDb(characteristics)
  return {
    ...character,
    characteristics,
    mov: character.mov ?? 8,
    build: character.build ?? derivedCombat.build,
    damageBonus: character.damageBonus ?? derivedCombat.damageBonus,
  }
}

function mergeLiaoqieCharacterDefaults(character: Character, defaults: Character): Character {
  return {
    ...defaults,
    ...character,
    characteristics: character.characteristics ?? defaults.characteristics,
    mov: character.mov ?? defaults.mov,
    build: character.build ?? defaults.build,
    damageBonus: character.damageBonus ?? defaults.damageBonus,
    skills: { ...defaults.skills, ...(character.skills ?? {}) },
    skillBreakdown: character.skillBreakdown ?? defaults.skillBreakdown,
    sheetExtras: character.sheetExtras ?? defaults.sheetExtras,
    backstory: character.backstory ?? defaults.backstory,
    privateNotes: character.privateNotes ?? defaults.privateNotes,
    conditions: character.conditions?.length ? character.conditions : defaults.conditions,
  }
}

function normalizeLiaoqieScenes(scenes: CampaignState['scenes']): CampaignState['scenes'] {
  const repairedScenes = scenes.map((scene) => {
    const defaults = LIAOQIE_SCENE_DEFAULTS.get(scene.id)
    return defaults
      ? {
          ...scene,
          title: defaults.title,
          location: defaults.location,
          summary: defaults.summary,
          pressure: defaults.pressure,
          sourceRef: defaults.sourceRef,
        }
      : scene
  })
  const existingIds = new Set(repairedScenes.map((scene) => scene.id))
  const missingScenes = seedCampaign.scenes.filter((scene) => !existingIds.has(scene.id))
  return [...repairedScenes, ...missingScenes]
}

function isFreshLiaoqieOpening(campaign: CampaignState): boolean {
  const hasRevealedSceneClue = campaign.clues.some(
    (clue) => clue.sceneId === LIAOQIE_INITIAL_SCENE_ID && clue.status === 'revealed',
  )
  const currentSceneStatus = campaign.storyGraph?.nodeStatuses?.[LIAOQIE_INITIAL_SCENE_ID]
  return (
    campaign.currentSceneId === LIAOQIE_INITIAL_SCENE_ID &&
    currentSceneStatus !== 'completed' &&
    !hasRevealedSceneClue
  )
}

function repairOpeningSuggestions(campaign: CampaignState): CampaignState {
  if (!isFreshLiaoqieOpening(campaign)) return campaign
  const latest = campaign.suggestions[0]
  const latestText = latest ? `${latest.situationSummary} ${latest.nextMoves.join(' ')}` : ''
  const hasStaleIndoorSuggestion = STALE_OPENING_SUGGESTION_MARKERS.some((marker) => latestText.includes(marker))
  const hasPerimeterOpeningText = latestText.includes('公寓楼下') || latestText.includes('尚未进入屋内') || latestText.includes('楼下警察')
  return {
    ...campaign,
    suggestions: latest && !hasStaleIndoorSuggestion && hasPerimeterOpeningText ? campaign.suggestions : [openingSuggestion],
  }
}

function withLiaoqieDossiers(campaign: CampaignState, installDemoCast = false): CampaignState {
  const repairedCampaign = {
    ...campaign,
    characters: campaign.characters.map(normalizeCharacterSheet),
  }

  if (!hasLiaoqieModule(repairedCampaign)) return repairedCampaign

  const defaultDossiers = new Map<string, Character>(
    [...moduleNpcs, ...demoInvestigators].map((character): [string, Character] => [character.id, character]),
  )
  const characters = repairedCampaign.characters.map((character) => {
    const defaults = defaultDossiers.get(character.id)
    return defaults ? mergeLiaoqieCharacterDefaults(character, defaults) : character
  })

  const existingIds = new Set(characters.map((character) => character.id))
  const missingNpcs = moduleNpcs.filter((npc) => !existingIds.has(npc.id))
  const missingInvestigators = installDemoCast ? demoInvestigators.filter((investigator) => !existingIds.has(investigator.id)) : []

  return repairOpeningSuggestions({
    ...repairedCampaign,
    scenes: normalizeLiaoqieScenes(repairedCampaign.scenes),
    characters: [...characters, ...missingInvestigators, ...missingNpcs],
  })
}

function normalizeCampaign(value: unknown, options: NormalizeOptions = {}): CampaignState {
  if (isCharacterLike(value)) {
    return withLiaoqieDossiers({
      ...seedCampaign,
      characters: [value],
      suggestions: [openingSuggestion],
      storyGraph: resetStoryGraphState(),
    }, options.installDemoCast)
  }

  const partial = value && typeof value === 'object' ? (value as Partial<CampaignState>) : {}

  if (isLegacyRainyArchiveCampaign(partial)) {
    return withLiaoqieDossiers({
      ...seedCampaign,
      characters: Array.isArray(partial.characters) ? partial.characters.filter((character) => character.type === 'investigator') : seedCampaign.characters,
      logs: [],
      rolls: [],
      suggestions: [openingSuggestion],
      storyGraph: resetStoryGraphState(),
    }, true)
  }

  return withLiaoqieDossiers({
    ...seedCampaign,
    ...partial,
    campaignName: typeof partial.campaignName === 'string' ? partial.campaignName : seedCampaign.campaignName,
    moduleName: typeof partial.moduleName === 'string' ? partial.moduleName : seedCampaign.moduleName,
    currentSceneId: typeof partial.currentSceneId === 'string' ? partial.currentSceneId : seedCampaign.currentSceneId,
    characters: Array.isArray(partial.characters) ? partial.characters : seedCampaign.characters,
    scenes: Array.isArray(partial.scenes) && partial.scenes.length ? partial.scenes : seedCampaign.scenes,
    clues: Array.isArray(partial.clues) ? partial.clues : seedCampaign.clues,
    clocks: Array.isArray(partial.clocks) ? partial.clocks : seedCampaign.clocks,
    logs: Array.isArray(partial.logs) ? partial.logs : seedCampaign.logs,
    rolls: Array.isArray(partial.rolls) ? partial.rolls : [],
    suggestions: Array.isArray(partial.suggestions) && partial.suggestions.length ? partial.suggestions : [openingSuggestion],
    storyGraph: partial.storyGraph ?? resetStoryGraphState(),
  }, options.installDemoCast)
}

function loadCampaign(): CampaignState {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) {
    localStorage.setItem(LIAOQIE_CAST_STORAGE_KEY, '1')
    return normalizeCampaign(seedCampaign)
  }
  try {
    const installDemoCast = !localStorage.getItem(LIAOQIE_CAST_STORAGE_KEY)
    const repaired = normalizeCampaign(JSON.parse(saved), { installDemoCast })
    if (installDemoCast && hasLiaoqieModule(repaired)) {
      localStorage.setItem(LIAOQIE_CAST_STORAGE_KEY, '1')
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repaired))
    return repaired
  } catch {
    const fallback = normalizeCampaign(seedCampaign)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback))
    return fallback
  }
}

function nowLabel(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function buildSuggestion(action: string, state: CampaignState): AssistantSuggestion {
  const lower = action.toLowerCase()
  const agentContext = buildAgentContext(state)
  const wantsBody = /尸|医学|验尸|舌|死因|medicine|body/.test(lower)
  const wantsInterview = /问|邻居|访谈|说服|心理|交谈|interview|talk/.test(lower)
  const wantsSearch = /找|查|观察|侦查|搜索|线索|瓶|残留|search|spot/.test(lower)
  const currentScene = state.scenes.find((scene) => scene.id === state.currentSceneId) ?? state.scenes[0]
  const primaryPc = state.characters.find((character) => character.type === 'investigator') ?? state.characters[0]
  const targetCharacterId = primaryPc?.id ?? ''
  const isOpeningAtScenePerimeter = isFreshLiaoqieOpening(state)

  const checks: CheckSuggestion[] = []
  const proposedChanges: ProposedChange[] = []

  if (isOpeningAtScenePerimeter) {
    checks.push({
      id: crypto.randomUUID(),
      skill: wantsInterview ? 'persuade' : 'spot_hidden',
      label: wantsInterview ? '取得进入许可或楼下证词' : '观察公寓楼下情况',
      targetCharacterId,
      difficulty: 'regular',
      reason: wantsInterview
        ? '用于说服警察、房东或邻居开口，或取得上楼/进入房间的许可。'
        : '用于观察楼下警戒、人群、楼梯、门禁和可进入路线；屋内线索尚未成为玩家已见信息。',
    })

    return {
      id: crypto.randomUUID(),
      situationSummary: `你们抵达${displaySceneLocation(currentScene.location)}。楼下已经拉起临时警戒，警察、房东和几个压低声音的邻居都在回避彼此的视线；真正的房间还在楼上，眼下最先要决定的是你们如何说明来意、取得进入许可，或者先从楼下的人群和环境里找出异常。`,
      nextMoves: [
        `当前在场调查员：${agentContext.partySummary.investigatorCount} 人（${agentContext.partySummary.investigators.map((investigator) => investigator.name).join('、') || '无'}）。`,
        'KP 私密：当前状态只确认调查员到达楼下，不把尸体、小玻璃瓶、黑舌、尸检报告视为玩家已见信息。',
        'KP 私密：等 KP 明确确认调查员上楼并进入房间后，再把死亡现场内部线索纳入玩家可见文本。',
      ],
      checks,
      clueTriggers: ['待确认：调查员是否取得上楼/进入房间的许可。', '待确认：是否记录楼下警察、房东或邻居的初步态度。'],
      npcReactions: ['警察优先维持秩序，房东紧张回避，邻居会根据调查员态度决定是否开口。'],
      riskWarnings: ['当前仍在楼下；不要让建议检定跳到尸体、小玻璃瓶、黑舌或尸检报告。'],
      proposedChanges,
      sources: [
        { label: `场景：${currentScene.title}`, path: currentScene.sourceRef },
        { label: '当前团状态：开局尚未揭示现场内部线索', path: 'campaign/current-state' },
      ],
    }
  }

  if (wantsBody) {
    checks.push({
      id: crypto.randomUUID(),
      skill: 'medicine',
      label: '判断异常死因',
      targetCharacterId,
      difficulty: 'regular',
      reason: '检查尸体可以确认死因不符合常规中毒或疾病，但不应直接揭示黑血来源。',
    })
  }

  if (wantsInterview) {
    checks.push({
      id: crypto.randomUUID(),
      skill: 'psychology',
      label: '安抚并判断证词',
      targetCharacterId,
      difficulty: 'regular',
      reason: '询问邻居或知情者时，心理学和社交技能可帮助区分恐惧、隐瞒和真实记忆。',
    })
  }

  if (wantsSearch || checks.length === 0) {
    checks.push({
      id: crypto.randomUUID(),
      skill: 'spot_hidden',
      label: '搜索死亡现场异常',
      targetCharacterId,
      difficulty: 'regular',
      reason: '初始现场的关键在尸体周边、黑色残留物、小玻璃瓶和被忽略的生活痕迹。',
    })
  }

  return {
    id: crypto.randomUUID(),
    situationSummary: `你们靠近${currentScene.title}。屋内的空气沉闷而发酸，死者的姿态僵硬得不太自然；最刺眼的是那条发黑的舌头，以及桌边几只不起眼的小玻璃瓶。你们可以分头检查尸体、搜索房间，或去问问隔壁的人到底听见过什么。`,
    nextMoves: [
      `当前在场调查员：${agentContext.partySummary.investigatorCount} 人（${agentContext.partySummary.investigators.map((investigator) => investigator.name).join('、') || '无'}）。`,
      wantsBody ? 'KP 私密：尸体检查只应确认“死因异常、营养不良、脱水、黑舌”，不要直接跳到黑血真相。' : 'KP 私密：如果玩家没有明确目标，先把可互动对象落到尸体、桌面、瓶子、邻居、验尸官五类。',
      wantsInterview ? 'KP 私密：邻居证词可以透露噩梦、尖叫和行为变化；语气应是犹豫和害怕，而不是主动爆料。' : 'KP 私密：小玻璃瓶是第一场景最稳的钩子，可用气味、残液和死者手中瓶子引导注意。',
      '内部守则：检定前只说明行动风险和方式，不向玩家公开成功/失败的完整后果。',
    ],
    checks,
    clueTriggers: ['待确认：是否揭示“小玻璃瓶”。', '待确认：是否记录“邻居证词”。', '待确认：是否触发目睹尸体的 0/1D4 理智检定。'],
    npcReactions: ['邻居和验尸官会先保持谨慎，成功的社交或专业检定可换来更具体的异常描述。'],
    riskWarnings: ['避免让 AI 直接宣布真相；检定只能推动线索层级，最终裁定仍由 KP 确认。'],
    proposedChanges,
    sources: [
      { label: `场景：${currentScene.title}`, path: currentScene.sourceRef },
      { label: '本轮玩家行动', path: 'session/current-action' },
    ],
  }
}

function App() {
  const [campaign, setCampaign] = useState<CampaignState>(loadCampaign)
  const [activeView, setActiveView] = useState<'console' | 'story' | 'context'>('console')
  const [action, setAction] = useState('我要开始序幕，把四名调查员合理聚到雷斯尼克校外公寓楼下。')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSimulatingPlayers, setIsSimulatingPlayers] = useState(false)
  const [providerStatus, setProviderStatus] = useState('DeepSeek ready')
  const [isCreatorOpen, setIsCreatorOpen] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)

  const currentScene = useMemo(
    () => campaign.scenes.find((scene) => scene.id === campaign.currentSceneId) ?? campaign.scenes[0],
    [campaign],
  )
  const campaignTitle = displayCampaignName(campaign.campaignName)
  const moduleTitle = displayModuleName(campaign.moduleName)
  const kpAgentContext = useMemo(() => buildKpAgentContextBundle(campaign), [campaign])
  const currentDisplayLocation = displaySceneLocation(currentScene.location)
  const latestSuggestion = campaign.suggestions[0]
  const selectedCharacter = selectedCharacterId ? campaign.characters.find((character) => character.id === selectedCharacterId) : undefined
  const investigators = useMemo(() => campaign.characters.filter((character) => character.type === 'investigator'), [campaign.characters])
  const dossierNpcs = useMemo(() => campaign.characters.filter((character) => character.type !== 'investigator'), [campaign.characters])
  const sceneClues = useMemo(
    () => campaign.clues.filter((clue) => clue.sceneId === currentScene.id || clue.status !== 'hidden'),
    [campaign.clues, currentScene.id],
  )
  const rawChatLogs = useMemo(
    () => campaign.logs.filter((log) => log.type === 'player_action' || log.type === 'keeper_ruling'),
    [campaign.logs],
  )
  const chatTranscript = useMemo(() => {
    const chronologicalLogs = [...rawChatLogs].reverse()
    return chronologicalLogs.map((log, index) => {
      const isKeeper = log.type === 'keeper_ruling'
      const playerIndex = chronologicalLogs.slice(0, index + 1).filter((item) => item.type === 'player_action').length - 1
      const actor = investigators.length ? investigators[playerIndex % investigators.length] : undefined
      const speaker = isKeeper ? 'KP' : log.speaker || actor?.player || actor?.name || `玩家${String.fromCharCode(65 + (playerIndex % 26))}`
      return {
        ...log,
        isKeeper,
        speaker,
        content: log.content.replace(/^(公开|私聊|KP 备注)：/, ''),
      }
    })
  }, [investigators, rawChatLogs])
  const [kpSpeech, setKpSpeech] = useState('')
  const speechTarget: 'public' | 'private' | 'note' = 'public'
  const renderLegacyWorkspace = false

  function syncModuleState(next: CampaignState) {
    fetch('http://127.0.0.1:8787/api/module-state/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campaign: next }),
    }).catch((error) => {
      console.warn('Module state sync failed', error)
    })
  }

  function updateCampaign(next: CampaignState) {
    setCampaign(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    syncModuleState(next)
  }

  function saveCampaign() {
    const blob = new Blob([JSON.stringify(campaign, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaign.campaignName}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target!.result as string)
        if (isCharacterLike(parsed)) {
          updateCampaign(normalizeCampaign({
            ...campaign,
            characters: [...campaign.characters.filter((item) => item.id !== parsed.id), parsed],
          }))
          setSelectedCharacterId(parsed.id)
          return
        }
        updateCampaign(normalizeCampaign(parsed))
      } catch { /* invalid JSON */ }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function resetDemo() {
    updateCampaign({
      ...seedCampaign,
      logs: [],
      rolls: [],
      suggestions: [openingSuggestion],
      storyGraph: resetStoryGraphState(),
    })
    setAction('')
    setKpSpeech('')
  }

  async function requestAssistantSuggestion(trimmedAction: string) {
    const payload = JSON.stringify({ action: trimmedAction, campaign, kpAgentContext })
    const request = async (path: string) => {
      const response = await fetch(`http://127.0.0.1:8787${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? `Provider returned ${response.status}`)
      }
      return (await response.json()) as { suggestion: AssistantSuggestion }
    }

    const body = await request('/api/kp-agent')
    return body.suggestion
  }

  async function requestSimulatedRound() {
    const response = await fetch('http://127.0.0.1:8787/api/simulate/round', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campaign, kpAgentContext }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? `Provider returned ${response.status}`)
    }
    return (await response.json()) as { messages: SimulatedPlayerMessage[] }
  }

  async function askKpAgent() {
    const trimmed = kpSpeech.trim()
    if (!trimmed) return
    setIsGenerating(true)
    setProviderStatus('KP Agent 思考中')
    try {
      const suggestion = await requestAssistantSuggestion(trimmed)
      updateCampaign({
        ...campaign,
        logs: [
          {
            id: crypto.randomUUID(),
            time: nowLabel(),
            type: 'state_change',
            content: `KP Agent 请求：${trimmed}`,
            confirmed: true,
          },
          ...campaign.logs,
        ],
        suggestions: [suggestion, ...campaign.suggestions],
      })
      setProviderStatus('KP Agent 已生成')
    } catch (error) {
      const suggestion = buildSuggestion(trimmed, campaign)
      updateCampaign({
        ...campaign,
        logs: [
          {
            id: crypto.randomUUID(),
            time: nowLabel(),
            type: 'state_change',
            content: `KP Agent 本地兜底：${trimmed}${error instanceof Error ? `（${error.message}）` : ''}`,
            confirmed: true,
          },
          ...campaign.logs,
        ],
        suggestions: [suggestion, ...campaign.suggestions],
      })
      setProviderStatus('KP Agent 使用本地兜底')
    } finally {
      setIsGenerating(false)
    }
  }

  function fallbackSimulatedMessages(): SimulatedPlayerMessage[] {
    const first = investigators[0]
    const second = investigators[1] ?? investigators[0]
    return [
      {
        speaker: first?.player || first?.name || '模拟玩家A',
        characterId: first?.id,
        content: '我先观察当前场景里最明显的异常点，尤其是入口、痕迹和附近有没有人影。',
      },
      {
        speaker: second?.player || second?.name || '模拟玩家B',
        characterId: second?.id,
        content: '我留意周围动静，提醒大家先别分散，必要的话我可以负责把风。',
      },
    ]
  }

  async function simulatePlayerRound() {
    if (isSimulatingPlayers) return
    setIsSimulatingPlayers(true)
    setProviderStatus('模拟玩家思考中')
    try {
      const round = await requestSimulatedRound()
      const messages = round.messages.length ? round.messages : fallbackSimulatedMessages()
      const logs: LogEntry[] = messages.map((message) => ({
        id: message.id ?? crypto.randomUUID(),
        time: nowLabel(),
        type: 'player_action' as const,
        content: message.content,
        speaker: message.speaker,
        characterId: message.characterId,
        confirmed: true,
      }))
      updateCampaign({ ...campaign, logs: [...logs].reverse().concat(campaign.logs) })
      setProviderStatus('模拟玩家已发言')
    } catch (error) {
      const logs: LogEntry[] = fallbackSimulatedMessages().map((message) => ({
        id: crypto.randomUUID(),
        time: nowLabel(),
        type: 'player_action' as const,
        content: message.content,
        speaker: message.speaker,
        characterId: message.characterId,
        confirmed: true,
      }))
      updateCampaign({ ...campaign, logs: [...logs].reverse().concat(campaign.logs) })
      setProviderStatus(`模拟玩家本地兜底：${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setIsSimulatingPlayers(false)
    }
  }

  async function submitAction(inputText = action) {
    const trimmed = inputText.trim()
    if (!trimmed) return
    setIsGenerating(true)
    setProviderStatus('正在请求 DeepSeek')
    const actionLog = {
      id: crypto.randomUUID(),
      time: nowLabel(),
      type: 'player_action' as const,
      content: trimmed,
      confirmed: true,
    }
    try {
      const suggestion = await requestAssistantSuggestion(trimmed)
      updateCampaign({
        ...campaign,
        logs: [actionLog, ...campaign.logs],
        suggestions: [suggestion, ...campaign.suggestions],
      })
      setProviderStatus('DeepSeek 已生成建议')
    } catch (error) {
      const suggestion = buildSuggestion(trimmed, campaign)
      updateCampaign({
        ...campaign,
        logs: [
          actionLog,
          {
            id: crypto.randomUUID(),
            time: nowLabel(),
            type: 'keeper_ruling' as const,
            content: `DeepSeek 暂不可用，已使用本地建议兜底。${error instanceof Error ? error.message : ''}`,
            confirmed: true,
          },
          ...campaign.logs,
        ],
        suggestions: [suggestion, ...campaign.suggestions],
      })
      setProviderStatus('DeepSeek 不可用，已使用本地兜底')
    } finally {
      setIsGenerating(false)
    }
  }

  function applyResourceCost(characterIds: string[], resource: 'hp' | 'san' | 'mp' | 'luck', amount: number) {
    if (!amount) return
    const targetNames = campaign.characters
      .filter((character) => characterIds.includes(character.id))
      .map((character) => character.name)
    const resourceLabel = resource === 'hp' ? 'HP' : resource === 'san' ? 'SAN' : resource === 'mp' ? 'MP' : 'Luck'
    updateCampaign({
      ...campaign,
      characters: campaign.characters.map((character) => {
        if (!characterIds.includes(character.id)) return character
        if (resource === 'hp') return { ...character, hp: Math.max(0, character.hp - amount) }
        if (resource === 'san') return { ...character, san: Math.max(0, character.san - amount) }
        if (resource === 'mp') return { ...character, mp: Math.max(0, character.mp - amount) }
        return { ...character, luck: Math.max(0, character.luck - amount) }
      }),
      logs: [
        {
          id: crypto.randomUUID(),
          time: nowLabel(),
          type: 'state_change',
          content: `资源变更：${targetNames.join('、') || '未知目标'} 扣除 ${resourceLabel} ${amount}`,
          confirmed: true,
        },
        ...campaign.logs,
      ],
    })
  }

  function submitKeeperSpeech() {
    const trimmed = kpSpeech.trim()
    if (!trimmed) return
    const targetLabel = speechTarget === 'public' ? '公开' : speechTarget === 'private' ? '私聊' : 'KP 备注'
    updateCampaign({
      ...campaign,
      logs: [
        {
          id: crypto.randomUUID(),
          time: nowLabel(),
          type: 'keeper_ruling',
          content: `${targetLabel}：${trimmed}`,
          confirmed: speechTarget !== 'note',
        },
        ...campaign.logs,
      ],
    })
    setKpSpeech('')
  }

  function addCreatedCharacter(character: Character) {
    updateCampaign({
      ...campaign,
      characters: [...campaign.characters.filter((item) => item.id !== character.id), character],
      logs: [
        {
          id: crypto.randomUUID(),
          time: nowLabel(),
          type: 'state_change',
          content: `创建调查员：${character.name}（${character.role}）`,
          confirmed: true,
        },
        ...campaign.logs,
      ],
    })
    setSelectedCharacterId(character.id)
  }

  function deleteInvestigator(character: Character) {
    if (!window.confirm(`确认删除调查员「${character.name}」吗？`)) return
    const nextCharacters = campaign.characters.filter((item) => item.id !== character.id)
    const remainingInvestigators = nextCharacters.filter((item) => item.type === 'investigator')
    updateCampaign({
      ...campaign,
      characters: nextCharacters,
      logs: [
        {
          id: crypto.randomUUID(),
          time: nowLabel(),
          type: 'state_change',
          content: `删除调查员：${character.name}。当前调查员数量：${remainingInvestigators.length}（${remainingInvestigators.map((item) => item.name).join('、') || '无'}）`,
          confirmed: true,
        },
        ...campaign.logs,
      ],
    })
    if (selectedCharacterId === character.id) {
      setSelectedCharacterId(null)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">COC KP Agent demo</p>
          <h1>{campaignTitle}</h1>
        </div>
        <div className="topbar-actions">
          <span className="module-pill">{moduleTitle}</span>
          <span className="module-pill">{providerStatus}</span>
          <div className="view-switcher" aria-label="主视图切换">
            <button className={activeView === 'console' ? 'active' : ''} type="button" onClick={() => setActiveView('console')}>
              KP 控制台
            </button>
            <button className={activeView === 'story' ? 'active' : ''} type="button" onClick={() => setActiveView('story')}>
              剧情图谱
            </button>
            <button className={activeView === 'context' ? 'active' : ''} type="button" onClick={() => setActiveView('context')}>
              上下文
            </button>
          </div>
          <button className="primary-button" type="button" onClick={() => setIsCreatorOpen(true)}>
            创建调查员
          </button>
          <button className="ghost-button" type="button" onClick={saveCampaign}>保存</button>
          <label className="ghost-button" style={{ cursor: 'pointer' }}>
            导入<input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
          <button className="ghost-button" type="button" onClick={resetDemo}>清空</button>
        </div>
      </header>

      {activeView === 'story' ? (
        <StoryGraphDemo campaign={campaign} />
      ) : activeView === 'context' ? (
        <ContextInspector campaign={campaign} contextBundle={kpAgentContext} latestRequest={kpSpeech || action} />
      ) : (
      <>
        <section className="kp-console" aria-label="KP 控制台">
          <aside className="console-roster" aria-label="调查员与 NPC 名册">
            <Panel title="调查员">
              <div className="roster-stack">
                {investigators.length ? (
                  investigators.map((character) => (
                    <article className="roster-card roster-card-button" key={character.id}>
                      <button className="roster-card-main" type="button" onClick={() => setSelectedCharacterId(character.id)}>
                        <div className="roster-card-head">
                          <div>
                            <h3>{character.name}</h3>
                            <p>{character.role}</p>
                          </div>
                          <span className="roster-card-location">当前：{currentDisplayLocation}</span>
                        </div>
                        <dl className="vital-grid">
                          <Stat label="HP" value={`${character.hp}/${character.hpMax}`} />
                          <Stat label="SAN" value={`${character.san}/${character.sanMax}`} />
                          <Stat label="MP" value={character.mp} />
                          <Stat label="MOV" value={character.mov ?? '-'} />
                        </dl>
                        <div className="tag-row">
                          {character.conditions.length ? character.conditions.map((tag) => <span key={tag}>{tag}</span>) : <span>状态稳定</span>}
                        </div>
                      </button>
                      <button
                        aria-label={`删除调查员 ${character.name}`}
                        className="roster-delete-button"
                        onClick={() => deleteInvestigator(character)}
                        type="button"
                        title="删除调查员"
                      >
                        删除
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="empty-note">尚未加入调查员。</p>
                )}
              </div>
            </Panel>

            <Panel title="NPC 资料卡">
              <div className="roster-stack">
                {dossierNpcs.length ? (
                  dossierNpcs.map((npc) => (
                    <button className="npc-dossier" type="button" key={npc.id} onClick={() => setSelectedCharacterId(npc.id)}>
                      <div>
                        <h3>{npc.name}</h3>
                        <p>{npc.role}</p>
                      </div>
                      <span>{npc.conditions[0] || '可登场'}</span>
                      {npc.privateNotes && <small>{npc.privateNotes}</small>}
                    </button>
                  ))
                ) : (
                  <p className="empty-note">还没有带资料卡的 NPC。</p>
                )}
              </div>
            </Panel>
          </aside>

          <section className="console-records" aria-label="跑团记录">
            <article className="scene-sheet console-scene">
              <div className="scene-meta">
                <span>{currentScene.location}</span>
                <span>{currentScene.sourceRef}</span>
              </div>
              <h2>{currentScene.title}</h2>
              <p>{currentScene.summary}</p>
              <div className="pressure-strip">
                <strong>压力源</strong>
                <span>{currentScene.pressure}</span>
              </div>
            </article>

            <section className="record-split">
              <Panel title="跑团记录 / KP Agent">
                <div className="chat-log">
                  {chatTranscript.length ? (
                    chatTranscript.map((log) => (
                      <article className={`chat-line ${log.isKeeper ? 'is-keeper' : 'is-player'}`} key={log.id}>
                        <div>
                          <span>{log.speaker}</span>
                          <time>{log.time}</time>
                        </div>
                        <p>{log.content}</p>
                      </article>
                    ))
                  ) : (
                    <p className="empty-note">暂无聊天记录。</p>
                  )}
                </div>

                <div className="chat-composer">
                  <label htmlFor="kp-chat-input">告诉 KP Agent 你想要什么</label>
                  <textarea
                    id="kp-chat-input"
                    value={kpSpeech}
                    onChange={(event) => setKpSpeech(event.target.value)}
                    placeholder="例如：我要开始序幕，把四名调查员合理聚到雷斯尼克校外公寓楼下。或：玩家已经进入房间，想检查尸体和小玻璃瓶，帮我给下一句。"
                    rows={4}
                  />
                  <div className="chat-composer-actions">
                    <button className="ghost-button" type="button" onClick={simulatePlayerRound} disabled={isSimulatingPlayers}>
                      {isSimulatingPlayers ? '模拟中...' : '模拟玩家一轮'}
                    </button>
                    <button className="primary-button" type="button" onClick={askKpAgent} disabled={isGenerating}>
                      {isGenerating ? '思考中...' : '询问 KP Agent'}
                    </button>
                    <button className="ghost-button" type="button" onClick={submitKeeperSpeech}>
                      作为 KP 发言保存
                    </button>
                  </div>
                </div>

                <section className="agent-output" aria-label="KP Agent 输出">
                  <article className="agent-output-block is-public">
                    <span>可以直接说给玩家的话</span>
                    <p>{latestSuggestion.situationSummary}</p>
                  </article>
                  <article className="agent-output-block">
                    <span>建议检定 / 规则处理</span>
                    {latestSuggestion.checks.length ? (
                      <ul>
                        {latestSuggestion.checks.map((check) => (
                          <li key={check.id}>
                            {labelForSkill(check.skill)} / {check.difficulty === 'regular' ? '普通' : check.difficulty === 'hard' ? '困难' : '极难'}：{check.reason}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>本轮不强制检定，先让玩家明确行动对象。</p>
                    )}
                  </article>
                </section>
              </Panel>
            </section>
          </section>

          <aside className="console-tools" aria-label="掷骰判定与 Agent 上下文">
            <DiceAdjudicator campaign={campaign} onApplyResourceCost={applyResourceCost} />

            <Panel title="线索 / 进度">
              <div className="console-compact-grid">
                {sceneClues.map((clue) => (
                  <article className={`clue-item is-${clue.status}`} key={clue.id}>
                    <div>
                      <h3>{clue.title}</h3>
                      <p>{clue.status === 'hidden' ? clue.revealHint : clue.content}</p>
                    </div>
                    <span>{clue.status === 'revealed' ? '已揭示' : clue.status === 'available' ? '可触发' : '隐藏'}</span>
                  </article>
                ))}
                {campaign.clocks.map((clock) => (
                  <article className="clock-card" key={clock.id}>
                    <div>
                      <h3>{clock.title}</h3>
                      <p>{clock.consequence}</p>
                    </div>
                    <div className="clock-dots" aria-label={`${clock.current}/${clock.max}`}>
                      {Array.from({ length: clock.max }, (_, index) => (
                        <span className={index < clock.current ? 'filled' : ''} key={index} />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </Panel>

          </aside>

        </section>

      {renderLegacyWorkspace && (
      <section className="workspace legacy-workspace" aria-label="KP 跑团控制台">
        <aside className="rail rail-left" aria-label="团状态">
          <Panel title="调查员">
            <div className="character-list">
              {campaign.characters
                .filter((character) => character.type === 'investigator')
                .map((character) => (
                  <button className="character-card character-card-button" type="button" key={character.id} onClick={() => setSelectedCharacterId(character.id)}>
                    <div>
                      <h3>{character.name}</h3>
                      <p>{character.role}</p>
                    </div>
                    <dl className="stat-grid">
                      <Stat label="HP" value={`${character.hp}/${character.hpMax}`} />
                      <Stat label="SAN" value={`${character.san}/${character.sanMax}`} />
                      <Stat label="Luck" value={character.luck} />
                      <Stat label="DEX" value={character.dex} />
                    </dl>
                    <div className="tag-row">
                      {character.conditions.length ? character.conditions.map((tag) => <span key={tag}>{tag}</span>) : <span>状态稳定</span>}
                    </div>
                  </button>
                ))}
            </div>
          </Panel>

          <Panel title="线索">
            <div className="clue-list">
              {campaign.clues.map((clue) => (
                <article className={`clue-item is-${clue.status}`} key={clue.id}>
                  <div>
                  <h3>{clue.title}</h3>
                  <p>{clue.status === 'hidden' ? clue.revealHint : clue.content}</p>
                  </div>
                  <span>{clue.status === 'revealed' ? '已揭示' : clue.status === 'available' ? '可触发' : '隐藏'}</span>
                </article>
              ))}
            </div>
          </Panel>
        </aside>

        <section className="center-stage" aria-label="当前场景和跑团日志">
          <article className="scene-sheet">
            <div className="scene-meta">
              <span>{currentScene.location}</span>
              <span>{currentScene.sourceRef}</span>
            </div>
            <h2>{currentScene.title}</h2>
            <p>{currentScene.summary}</p>
            <div className="pressure-strip">
              <strong>压力源</strong>
              <span>{currentScene.pressure}</span>
            </div>
          </article>

          <section className="action-console" aria-label="玩家行动输入">
            <label htmlFor="player-action">记录玩家行动</label>
            <textarea id="player-action" value={action} onChange={(event) => setAction(event.target.value)} rows={4} />
            <div className="console-actions">
              <button className="primary-button" type="button" onClick={() => submitAction()} disabled={isGenerating}>
                {isGenerating ? '生成中...' : '生成 KP 建议'}
              </button>
              <p>AI 只生成候选建议；正式状态必须由 KP 采纳。</p>
            </div>
          </section>

          <Panel title="跑团日志">
            <div className="timeline">
              {campaign.logs.map((log) => (
                <article className={`log-entry log-${log.type}`} key={log.id}>
                  <time>{log.time}</time>
                  <p>{log.content}</p>
                </article>
              ))}
            </div>
          </Panel>
        </section>

        <aside className="rail rail-right" aria-label="AI 建议和规则工具">
          <DiceAdjudicator campaign={campaign} onApplyResourceCost={applyResourceCost} />

          <Panel title="AI 建议">
            <div className="ai-card">
              <div className="ai-badge-row">
                <span className="ai-badge">AI-generated</span>
                <span>{latestSuggestion.sources.length} 个来源</span>
              </div>
              <p className="summary">{latestSuggestion.situationSummary}</p>
              <div className="suggestion-block">
                <h3>下一步</h3>
                <ul>
                  {latestSuggestion.nextMoves.map((move) => (
                    <li key={move}>{move}</li>
                  ))}
                </ul>
              </div>
              <div className="suggestion-block">
                <h3>风险提醒</h3>
                {latestSuggestion.riskWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
              <div className="source-row">
                {latestSuggestion.sources.map((source) => (
                  <span title={source.path} key={source.path}>
                    {source.label}
                  </span>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="进度钟">
            <div className="clock-list">
              {campaign.clocks.map((clock) => (
                <article className="clock-card" key={clock.id}>
                  <div>
                    <h3>{clock.title}</h3>
                    <p>{clock.consequence}</p>
                  </div>
                  <div className="clock-dots" aria-label={`${clock.current}/${clock.max}`}>
                    {Array.from({ length: clock.max }, (_, index) => (
                      <span className={index < clock.current ? 'filled' : ''} key={index} />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
      )}
      </>
      )}
      <CharacterCreator open={isCreatorOpen} onClose={() => setIsCreatorOpen(false)} onCreate={addCreatedCharacter} />
      {selectedCharacter && (
        <CharacterDetail character={selectedCharacter} currentLocation={currentDisplayLocation} onClose={() => setSelectedCharacterId(null)} />
      )}
    </main>
  )
}

function formatTokenCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function countOutlineArray(outline: unknown, key: string): number {
  if (!outline || typeof outline !== 'object') return 0
  const value = (outline as Record<string, unknown>)[key]
  return Array.isArray(value) ? value.length : 0
}

function ContextInspector(props: { campaign: CampaignState; contextBundle: KpAgentContextBundle; latestRequest: string }) {
  const { campaign, contextBundle, latestRequest } = props
  const [copyState, setCopyState] = useState('复制完整上下文')
  const { agentContext, moduleContext, budget } = contextBundle
  const requestPreview = useMemo(
    () => ({
      action: latestRequest || 'KP 尚未输入本次请求',
      campaign,
      kpAgentContext: contextBundle,
    }),
    [campaign, contextBundle, latestRequest],
  )
  const requestPreviewText = useMemo(() => JSON.stringify(requestPreview, null, 2), [requestPreview])
  const requestTokens = estimateContextTokens(requestPreviewText)
  const outline = moduleContext.structuredNavigation.outline
  const outlineSceneCount = countOutlineArray(outline, 'scenes')
  const outlineAssetCount = countOutlineArray(outline, 'assets')

  async function copyFullContext() {
    try {
      await navigator.clipboard.writeText(requestPreviewText)
      setCopyState('已复制')
      window.setTimeout(() => setCopyState('复制完整上下文'), 1400)
    } catch {
      setCopyState('复制失败')
      window.setTimeout(() => setCopyState('复制完整上下文'), 1400)
    }
  }

  return (
    <section className="context-page" aria-label="KP Agent 上下文查看器">
      <header className="context-hero">
        <div>
          <p className="eyebrow">KP Agent Context Inspector</p>
          <h2>实时上下文</h2>
          <p>这里展示下一次请求会交给 KP Agent 的材料包：完整模组、结构化导航、当前团况、记忆和预算。</p>
        </div>
        <button className="primary-button" type="button" onClick={copyFullContext}>
          {copyState}
        </button>
      </header>

      <section className="context-metrics" aria-label="上下文预算">
        <Stat label="输入估算" value={`${formatTokenCount(requestTokens)} tokens`} />
        <Stat label="模组资料" value={`${formatTokenCount(budget.moduleTokens)} tokens`} />
        <Stat label="团状态" value={`${formatTokenCount(budget.agentStateTokens)} tokens`} />
        <Stat label="预算占用" value={`${budget.estimatedUsagePercent}% / 1M`} />
        <Stat label="调查员" value={`${agentContext.partySummary.investigatorCount} 人`} />
        <Stat label="当前场景" value={agentContext.currentScene?.title ?? '-'} />
      </section>

      <section className="context-layout">
        <aside className="context-column">
          <Panel title="组装策略">
            <div className="context-ledger">
              <div>
                <span>策略</span>
                <strong>完整模组优先</strong>
                <p>《了却幻梦》规模很小，当前不做片段检索；每次请求直接提供完整模组全文。</p>
              </div>
              <div>
                <span>模型假设</span>
                <strong>{contextBundle.modelAssumption.model}</strong>
                <p>预留 {formatTokenCount(contextBundle.modelAssumption.reservedOutputTokens)} tokens 给输出。</p>
              </div>
            </div>
            <ol className="context-ordered-list">
              {contextBundle.assemblyOrder.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </Panel>

          <Panel title="模组资料">
            <div className="context-ledger">
              <div>
                <span>全文</span>
                <strong>{formatTokenCount(moduleContext.sourceText.estimatedTokens)}</strong>
                <p>{moduleContext.sourceText.path}</p>
              </div>
              <div>
                <span>结构化导航</span>
                <strong>
                  {outlineSceneCount} 场景 / {outlineAssetCount} 材料
                </strong>
                <p>{moduleContext.structuredNavigation.path}</p>
              </div>
              <div>
                <span>材料索引</span>
                <strong>{formatTokenCount(moduleContext.materialsIndex.estimatedTokens)}</strong>
                <p>{moduleContext.materialsIndex.path}</p>
              </div>
            </div>
            <ul className="context-rule-list">
              {moduleContext.usagePolicy.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </Panel>
        </aside>

        <section className="context-column context-column-main">
          <Panel title="当前团状态">
            <div className="context-snapshot-grid">
              <article>
                <span>有效调查员</span>
                <strong>{agentContext.partySummary.investigators.map((item) => item.name).join('、') || '无'}</strong>
              </article>
              <article>
                <span>已删除调查员</span>
                <strong>{agentContext.partySummary.removedInvestigators.map((item) => item.name).join('、') || '无'}</strong>
              </article>
              <article>
                <span>线索</span>
                <strong>
                  可发现 {agentContext.currentClues.available.length} / 已揭示 {agentContext.currentClues.revealed.length} / 隐藏{' '}
                  {agentContext.currentClues.hiddenCount}
                </strong>
              </article>
              <article>
                <span>近期原文</span>
                <strong>{agentContext.sessionMemory.shortTermTranscript.length} 条</strong>
              </article>
            </div>
            <details className="context-details" open>
              <summary>AgentContext JSON</summary>
              <pre>{JSON.stringify(agentContext, null, 2)}</pre>
            </details>
          </Panel>
        </section>

        <aside className="context-column">
          <Panel title="完整模组包">
            <details className="context-details">
              <summary>完整模组全文</summary>
              <pre>{moduleContext.sourceText.content}</pre>
            </details>
            <details className="context-details">
              <summary>结构化导航 JSON</summary>
              <pre>{JSON.stringify(moduleContext.structuredNavigation.outline, null, 2)}</pre>
            </details>
            <details className="context-details">
              <summary>材料索引</summary>
              <pre>{moduleContext.materialsIndex.content}</pre>
            </details>
          </Panel>

          <Panel title="实际请求预览">
            <p className="context-help">下方是下一次 `/api/kp-agent` 的核心 payload 预览，包含完整模组和当前团状态。</p>
            <details className="context-details">
              <summary>展开请求 JSON</summary>
              <pre>{requestPreviewText}</pre>
            </details>
          </Panel>
        </aside>
      </section>
    </section>
  )
}

function CharacterDetail(props: { character: Character; currentLocation: string; onClose: () => void }) {
  const { character, currentLocation } = props
  const portraitInitials = character.name.replace(/[·\s]/g, '').slice(0, 2) || '？'
  const displaySkills = character.skillBreakdown
    ? [...character.skillBreakdown].sort((a, b) => b.final - a.final)
    : Object.entries(character.skills)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
        .map(([key, value]) => ({ key, label: labelForSkill(key), category: '技能', base: 0, occupationAdded: 0, interestAdded: 0, final: value ?? 0, isOccupation: false }))

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="character-detail-title">
        <header className="modal-titlebar">
          <div>
            <p className="eyebrow">Investigator Sheet</p>
            <h2 id="character-detail-title">{character.name}</h2>
          </div>
          <button className="ghost-button" type="button" onClick={props.onClose}>
            关闭
          </button>
        </header>

        <section className="detail-profile">
          <div className="portrait-frame" aria-label={`${character.name} 头像`}>
            <span>{portraitInitials}</span>
            <small>Portrait</small>
          </div>
          <div>
            <h3>基础信息</h3>
            <dl className="detail-list">
              <Stat label="职业" value={character.role} />
              <Stat label="玩家" value={character.player || '-'} />
              <Stat label="年龄" value={character.age ?? '-'} />
              <Stat label="性别" value={character.sex || '-'} />
              <Stat label="当前位置" value={currentLocation || '-'} />
              <Stat label="住地" value={character.residence || '-'} />
              <Stat label="HP" value={`${character.hp}/${character.hpMax}`} />
              <Stat label="SAN" value={`${character.san}/${character.sanMax}`} />
              <Stat label="MP" value={character.mp} />
              <Stat label="MOV" value={character.mov ?? '-'} />
              <Stat label="Luck" value={character.luck} />
              <Stat label="DB" value={character.damageBonus ?? '-'} />
              <Stat label="体格" value={character.build ?? '-'} />
            </dl>
            {character.sheetExtras?.portraitNote && <p className="portrait-note">{character.sheetExtras.portraitNote}</p>}
          </div>
        </section>

        <section className="detail-section">
          <h3>属性</h3>
          {character.characteristics ? (
            <dl className="detail-list compact">
              {Object.entries(character.characteristics).map(([key, value]) => (
                <Stat label={key.toUpperCase()} value={value} key={key} />
              ))}
            </dl>
          ) : (
            <p className="empty-note detail-empty-note">未录入属性。</p>
          )}
        </section>

        <section className="detail-section">
          <h3>技能</h3>
          <div className="skill-table-wrap detail-skill-wrap">
            <table className="skill-table">
              <thead>
                <tr>
                  <th>技能</th>
                  <th>基础</th>
                  <th>职业</th>
                  <th>兴趣</th>
                  <th>最终</th>
                </tr>
              </thead>
              <tbody>
                {displaySkills.map((skill) => (
                  <tr key={skill.key}>
                    <td>{skill.label}</td>
                    <td>{skill.base}</td>
                    <td>{skill.occupationAdded}</td>
                    <td>{skill.interestAdded}</td>
                    <td>{skill.final}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {character.backstory && (
          <section className="detail-section">
            <h3>背景</h3>
            <dl className="detail-list">
              <Stat label="形象描述" value={character.backstory.personalDescription || '-'} />
              <Stat label="思想与信念" value={character.backstory.ideology || '-'} />
              <Stat label="重要之人" value={character.backstory.significantPeople || '-'} />
              <Stat label="意义非凡之地" value={character.backstory.meaningfulLocations || '-'} />
              <Stat label="宝贵之物" value={character.backstory.treasuredPossessions || '-'} />
              <Stat label="特质" value={character.backstory.traits || '-'} />
              <Stat label="难言之隐" value={character.backstory.darkSecret || '-'} />
              <Stat label="伤口和疤痕" value={character.backstory.injuriesScars || '-'} />
              <Stat label="恐惧症和躁狂症" value={character.backstory.phobiasManias || '-'} />
              <Stat label="调查员经历" value={character.backstory.investigatorExperiences || '-'} />
              <Stat label="神话相关" value={character.backstory.mythosEncounters || '-'} />
              <Stat label="法术一览" value={character.backstory.spells || '-'} />
              <Stat label="调查员伙伴" value={character.backstory.allies || '-'} />
            </dl>
          </section>
        )}

        {character.sheetExtras && (
          <section className="detail-section">
            <h3>资产装备</h3>
            <dl className="detail-list">
              <Stat label="时代" value={character.sheetExtras.era || '-'} />
              <Stat label="信用范围" value={character.sheetExtras.creditRatingRange || '-'} />
              <Stat label="现金" value={character.sheetExtras.cash || '-'} />
              <Stat label="消费水平" value={character.sheetExtras.spendingLevel || '-'} />
              <Stat label="资产" value={character.sheetExtras.assets || '-'} />
              <Stat label="装备" value={character.sheetExtras.equipment || '-'} />
              <Stat label="武器" value={character.sheetExtras.weapons || '-'} />
              <Stat label="护甲" value={character.sheetExtras.armor || '-'} />
            </dl>
          </section>
        )}

        {character.creationAudit && (
          <section className="detail-section">
            <h3>创建检查</h3>
            <p className="creator-note">
              {character.creationAudit.missing.length ? `仍有遗漏：${character.creationAudit.missing.join('、')}` : '核心项目已通过。'}
            </p>
            <p className="creator-note">来源：{character.creationAudit.source}</p>
          </section>
        )}
      </section>
    </div>
  )
}

function Panel(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <header>
        <h2>{props.title}</h2>
      </header>
      {props.children}
    </section>
  )
}

function Stat(props: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  )
}

export default App

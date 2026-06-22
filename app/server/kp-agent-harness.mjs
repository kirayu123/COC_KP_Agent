import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_AGENT_MODEL = 'deepseek-v4-pro'
const READABLE_RESOURCE_EXTENSIONS = new Set(['.md', '.json', '.txt'])
const SERVER_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(SERVER_DIR, '..', '..')
const LIAOQIE_AGENT_CONTEXT_DIR = resolve(PROJECT_ROOT, 'app', 'server', 'data', 'kp-agent', 'liaoque_huanmeng')
const LIAOQIE_MODULE_TEMPLATE_PATH = resolve(LIAOQIE_AGENT_CONTEXT_DIR, 'module_template.json')
const LIAOQIE_MODULE_STATE_PATH = resolve(LIAOQIE_AGENT_CONTEXT_DIR, 'module_state.json')
const LIAOQIE_INVESTIGATOR_INDEX_PATH = resolve(LIAOQIE_AGENT_CONTEXT_DIR, 'investigators', 'index.json')
const LIAOQIE_NPC_INDEX_PATH = resolve(LIAOQIE_AGENT_CONTEXT_DIR, 'npcs', 'index.json')
const RESOURCE_ROOTS = [
  { path: 'documents/runtime/liaoque_huanmeng', role: '模组原文：了却幻梦 source_text.md' },
]

const KpAgentState = Annotation.Root({
  payload: Annotation(),
  options: Annotation(),
  intent: Annotation(),
  contextPack: Annotation(),
  messages: Annotation(),
  resourcePlan: Annotation(),
  resourcePlans: Annotation(),
  toolResults: Annotation(),
  rawSuggestion: Annotation(),
  suggestion: Annotation(),
  trace: Annotation({
    reducer: (left = [], right = []) => left.concat(right),
    default: () => [],
  }),
})

function trace(node, detail = {}) {
  return {
    trace: [
      {
        node,
        detail,
        at: new Date().toISOString(),
      },
    ],
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function truncateText(text, maxChars) {
  const value = String(text ?? '')
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}\n\n[TRUNCATED: source text exceeded ${maxChars} characters]`
}

function safeJson(value, maxChars = 80_000) {
  try {
    return truncateText(JSON.stringify(value, null, 2), maxChars)
  } catch {
    return '[Unserializable value]'
  }
}

function stripCodeFence(text) {
  return String(text ?? '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
}

function stringifyListItem(item) {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return String(item ?? '')
  const label = item.label ?? item.title ?? item.name ?? item.kind ?? '事项'
  const detail = item.detail ?? item.reason ?? item.content ?? item.description ?? ''
  return detail ? `${label}：${detail}` : String(label)
}

function unwrapSuggestion(raw) {
  if (!raw || typeof raw !== 'object') return raw
  return (
    raw.suggestion ??
    raw.assistantSuggestion ??
    raw.AssistantSuggestion ??
    raw.result ??
    raw.response ??
    raw.output ??
    raw.data ??
    raw
  )
}

function pickValue(source, keys, fallback = undefined) {
  for (const key of keys) {
    if (source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== null) {
      return source[key]
    }
  }
  return fallback
}

function pickArray(source, keys) {
  const value = pickValue(source, keys, [])
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) return [value]
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

function topSkills(skills = {}, limit = 10) {
  return Object.entries(skills)
    .filter(([, value]) => typeof value === 'number')
    .sort(([, left], [, right]) => right - left)
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }))
}

function projectPathToAbsolute(projectPath) {
  return resolve(PROJECT_ROOT, ...String(projectPath).split('/'))
}

function toProjectPath(absolutePath) {
  return relative(PROJECT_ROOT, absolutePath).replace(/\\/g, '/')
}

function isInsideProject(absolutePath) {
  const relativePath = relative(PROJECT_ROOT, absolutePath)
  return relativePath && !relativePath.startsWith('..') && !resolve(relativePath).startsWith('..')
}

function extensionFor(path) {
  const match = String(path).toLowerCase().match(/(\.[^.\\/]+)$/)
  return match?.[1] ?? ''
}

function isReadableResourcePath(projectPath) {
  const normalized = String(projectPath ?? '').replace(/\\/g, '/')
  if (!normalized || normalized.includes('\0') || normalized.startsWith('.git/')) return false
  if (!READABLE_RESOURCE_EXTENSIONS.has(extensionFor(normalized))) return false
  const absolutePath = projectPathToAbsolute(normalized)
  if (!isInsideProject(absolutePath) || !existsSync(absolutePath) || !statSync(absolutePath).isFile()) return false
  return RESOURCE_ROOTS.some((root) => normalized === root.path || normalized.startsWith(`${root.path}/`))
}

function walkReadableFiles(rootPath) {
  const absoluteRoot = projectPathToAbsolute(rootPath)
  if (!existsSync(absoluteRoot)) return []
  const files = []
  const stack = [absoluteRoot]

  while (stack.length) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolutePath = resolve(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue
        stack.push(absolutePath)
        continue
      }
      if (!entry.isFile()) continue
      const projectPath = toProjectPath(absolutePath)
      if (isReadableResourcePath(projectPath)) {
        const stats = statSync(absolutePath)
        files.push({
          path: projectPath,
          bytes: stats.size,
          extension: extensionFor(projectPath),
        })
      }
    }
  }

  return files.sort((left, right) => left.path.localeCompare(right.path))
}

function buildOpenResourceCatalog() {
  const seen = new Set()
  const files = []
  for (const root of RESOURCE_ROOTS) {
    for (const file of walkReadableFiles(root.path)) {
      if (seen.has(file.path)) continue
      seen.add(file.path)
      files.push({
        ...file,
        root: root.path,
        rootRole: root.role,
      })
    }
  }

  return {
    schemaVersion: 'kp-agent-open-resource-catalog-v1',
    policy: {
      readableExtensions: [...READABLE_RESOURCE_EXTENSIONS],
      roots: RESOURCE_ROOTS,
      note: 'Agent 可以读取 catalog.files 中任意文件；目录由服务器动态扫描生成。',
    },
    fileCount: files.length,
    files,
  }
}

function readJsonFile(absolutePath, fallback) {
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return fallback
  }
}

function writeJsonFile(absolutePath, value) {
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function mergeRuntimeWithInitial(initialRuntime = {}, savedRuntime = {}) {
  const initial = deepClone(initialRuntime)
  const saved = deepClone(savedRuntime)
  return {
    ...initial,
    ...saved,
    activeInvestigatorIds: saved.activeInvestigatorIds ?? initial.activeInvestigatorIds ?? [],
    loadedNpcIds: saved.loadedNpcIds ?? initial.loadedNpcIds ?? [],
    notes: saved.notes ?? initial.notes ?? [],
    nodeStatuses: {
      ...(initial.nodeStatuses ?? {}),
      ...(saved.nodeStatuses ?? {}),
    },
    locationStates: {
      ...(initial.locationStates ?? {}),
      ...(saved.locationStates ?? {}),
    },
    clueStates: {
      ...(initial.clueStates ?? {}),
      ...(saved.clueStates ?? {}),
    },
  }
}

function composeModuleStateFromTemplate(moduleTemplate, runtimeState = {}) {
  const clockStates = runtimeState.pressureClockStates ?? {}
  const pressureClocks = asArray(moduleTemplate.pressureClocks).map((clock) => {
    const { defaultCurrent, ...staticClock } = clock
    const savedClock = clockStates[clock.id] ?? {}
    return {
      ...deepClone(staticClock),
      current: Number(savedClock.current ?? defaultCurrent ?? 0),
      max: Number(savedClock.max ?? staticClock.max ?? 0),
    }
  })

  return {
    schemaVersion: 'kp-agent-effective-module-state-v1',
    moduleId: moduleTemplate.moduleId,
    title: moduleTemplate.title,
    source: deepClone(moduleTemplate.source ?? {}),
    structure: deepClone(moduleTemplate.structure ?? {}),
    runtime: mergeRuntimeWithInitial(moduleTemplate.initialRuntime ?? {}, runtimeState.runtime ?? {}),
    pressureClocks,
    storyGraph: deepClone(moduleTemplate.storyGraph ?? { edges: [] }),
    scenes: deepClone(moduleTemplate.scenes ?? []),
    locations: deepClone(moduleTemplate.locations ?? []),
    clues: deepClone(moduleTemplate.clues ?? []),
    keeperTables: deepClone(moduleTemplate.keeperTables ?? {}),
  }
}

function serializeRuntimeModuleState(moduleState) {
  return {
    schemaVersion: 'kp-agent-module-state-v1',
    moduleId: moduleState.moduleId,
    title: moduleState.title,
    templatePath: 'app/server/data/kp-agent/liaoque_huanmeng/module_template.json',
    runtime: deepClone(moduleState.runtime ?? {}),
    pressureClockStates: Object.fromEntries(
      asArray(moduleState.pressureClocks).map((clock) => [
        clock.id,
        {
          current: Number(clock.current ?? 0),
          max: Number(clock.max ?? 0),
        },
      ]),
    ),
  }
}

function loadAgentResourcePack() {
  const moduleTemplate = readJsonFile(LIAOQIE_MODULE_TEMPLATE_PATH, undefined)
  const runtimeState = readJsonFile(LIAOQIE_MODULE_STATE_PATH, {})
  const investigatorIndex = readJsonFile(LIAOQIE_INVESTIGATOR_INDEX_PATH, { files: [] })
  const npcIndex = readJsonFile(LIAOQIE_NPC_INDEX_PATH, { files: [] })

  if (!moduleTemplate) {
    throw new Error(`Missing module template file: ${LIAOQIE_MODULE_TEMPLATE_PATH}`)
  }

  if (runtimeState.moduleId && runtimeState.moduleId !== moduleTemplate.moduleId) {
    throw new Error(`Module state/template mismatch: ${runtimeState.moduleId} !== ${moduleTemplate.moduleId}`)
  }

  const moduleState = composeModuleStateFromTemplate(moduleTemplate, runtimeState)
  return { moduleState, moduleTemplate, runtimeState, investigatorIndex, npcIndex }
}

function readIndexedFile(indexRecord) {
  if (!indexRecord?.file) return undefined
  return readJsonFile(projectPathToAbsolute(indexRecord.file), undefined)
}

function buildCompactRunSnapshot(campaign = {}, agentContext = {}) {
  const characters = asArray(campaign.characters)
  const investigators = characters
    .filter((character) => character.type === 'investigator')
    .map((character) => ({
      id: character.id,
      name: character.name,
      role: character.role,
      location: character.location ?? agentContext.currentScene?.location,
      hp: `${character.hp ?? '-'} / ${character.hpMax ?? '-'}`,
      san: `${character.san ?? '-'} / ${character.sanMax ?? '-'}`,
      mp: character.mp,
      mov: character.mov,
      luck: character.luck,
      conditions: character.conditions ?? [],
      topSkills: topSkills(character.skills),
    }))

  const recentTranscript = asArray(campaign.logs)
    .filter((log) => log.type === 'player_action' || log.type === 'keeper_ruling')
    .slice(0, 20)
    .reverse()
    .map((log) => ({
      time: log.time,
      type: log.type,
      speaker: log.speaker,
      characterId: log.characterId,
      content: log.content,
    }))

  return {
    campaignName: campaign.campaignName,
    moduleName: campaign.moduleName,
    currentSceneId: campaign.currentSceneId,
    investigators,
    recentTranscript,
    recentRolls: asArray(campaign.rolls).slice(0, 8),
    recentStateChanges: asArray(campaign.logs)
      .filter((log) => log.type === 'state_change')
      .slice(0, 12)
      .map((log) => ({ time: log.time, content: log.content, confirmed: log.confirmed })),
  }
}

function classifyIntentFromText(text) {
  const action = String(text ?? '')
  if (/序幕|开场|开局|聚集|集合|引入|导入角色/.test(action)) return 'opening_setup'
  if (/检定|掷骰|规则|困难|极难|孤注一掷|合作|对抗|扣血|扣SAN|理智/.test(action)) return 'rules_support'
  if (/NPC|人物|反应|态度|询问|交涉/.test(action)) return 'npc_reaction'
  if (/线索|证据|发现|调查|搜索|侦查|图书馆|聆听/.test(action)) return 'clue_and_scene_support'
  if (/总结|日志|记录|回顾|摘要/.test(action)) return 'session_memory'
  return 'keeper_advice'
}

function classifyAgentIntentFromText(text) {
  const action = String(text ?? '')
  if (/序幕|开场|开局|聚集|集合|引入|导入角色|楼下|抵达/.test(action)) return 'opening_setup'
  if (/检定|掷骰|规则|困难|极难|孤注一掷|合作|对抗|扣血|扣\s*SAN|理智/.test(action)) return 'rules_support'
  if (/NPC|人物|反应|态度|询问|交涉|审问/.test(action)) return 'npc_reaction'
  if (/线索|证据|发现|调查|搜索|侦查|图书馆|聆听|进入|上楼|房间/.test(action)) return 'clue_and_scene_support'
  if (/总结|日志|记录|回顾|摘要/.test(action)) return 'session_memory'
  return 'keeper_advice'
}

function buildRulesBrief() {
  return [
    'COC7 core resolution: roll d100 against a target value. Regular success is <= target, hard success is <= half target, extreme success is <= one fifth target.',
    'A result of 01 is a critical success. Fumble handling depends on target value: for skills below 50, 96-100 can fumble; for 50 or above, 100 fumbles.',
    'Bonus/penalty dice change the tens die; choose the best tens die for bonus and worst tens die for penalty.',
    'Pushed rolls are a second attempt after a failed roll when the player changes approach and accepts heightened consequences. The KP should foreshadow risk without revealing exact failure outcomes.',
    'Group/cooperative checks should clarify who rolls, what each participant contributes, and whether the task needs one success, multiple successes, or a lead roll with assistance.',
    'Opposed checks compare success level first, then higher skill value if tied, then reroll or KP adjudication if still tied.',
    'SAN and HP costs are consequences chosen by the KP. The assistant may suggest formulas such as 0/1D4 SAN or 1D3 HP, but should not apply them without KP confirmation.',
  ].join('\n')
}

function buildKeeperSystemPrompt() {
  return [
    '你是一个专业的 COC7 跑团主持辅助 Agent。你的工作不是替代 KP，而是帮助 KP 组织当前回合的主持材料、规则裁定和下一步选择。',
    '你服务的对象是 KP，因此你可以给出私密建议；但 situationSummary 字段必须是 KP 可以直接说给玩家听的话。',
    '你采用渐进式披露：先确认当前团状态、当前地点、玩家已经接触到的人和物，再决定本轮应该看哪些本地资料。',
    '每次处理请求时，你要像真实 KP 一样先问自己：当前调查员在哪里？他们已经知道什么？他们正在和谁互动？本轮 KP 想解决的是开场、场景推进、NPC 反应、检定，还是复盘？',
    '你的玩家可见叙述应该基于当前地点、当前可见对象、已揭示或可接触的信息；KP 私密建议可以说明可选检定、NPC 态度、压力条变化和可能的状态更新。',
    '你不要把未读取的资料当成事实使用。你可以多轮选择读取本地资料：每轮先判断当前资料是否足够，不足时只从资源清单里追加读取必要文件；足够时停止读取并生成建议。',
    '检定建议应服务于玩家行动。声明检定时只说明行动风险和判定方式，不替 KP 公开完整成功/失败后果。',
    '状态变化只写入 proposedChanges，等待 KP 确认；不要在建议中假定这些变化已经发生。',
    '输出必须是 JSON，不输出 Markdown。',
  ].join('\n')
}

function compactSceneResource(scene, moduleState) {
  return scene
    ? {
        id: scene.id,
        title: scene.title,
        phase: scene.phase,
        kind: scene.kind,
        defaultLocationId: scene.defaultLocationId,
        locationIds: scene.locationIds ?? [],
        status: moduleState.runtime?.nodeStatuses?.[scene.id],
      }
    : undefined
}

function compactLocationResource(location, moduleState) {
  return location
    ? {
        id: location.id,
        title: location.title,
        sceneId: location.sceneId,
        access: location.access,
        state: moduleState.runtime?.locationStates?.[location.id],
        npcIds: location.npcIds ?? [],
        clueIds: location.clueIds ?? [],
      }
    : undefined
}

function buildResourceManifest({ moduleState, campaign }) {
  const currentScene = findById(moduleState.scenes, moduleState.runtime?.currentSceneId)
  const currentLocation = findById(moduleState.locations, moduleState.runtime?.currentLocationId)
  const activeInvestigatorIds =
    moduleState.runtime?.activeInvestigatorIds?.length
      ? moduleState.runtime.activeInvestigatorIds
      : asArray(campaign.characters).filter((character) => character.type === 'investigator').map((character) => character.id)
  const catalog = buildOpenResourceCatalog()

  return {
    schemaVersion: 'kp-agent-resource-manifest-v2',
    mode: 'open_project_resource_catalog',
    runtimeSnapshot: {
      currentScene: compactSceneResource(currentScene, moduleState),
      currentLocation: compactLocationResource(currentLocation, moduleState),
      activeInvestigatorIds,
      campaignInvestigatorIds: asArray(campaign.characters)
        .filter((character) => character.type === 'investigator')
        .map((character) => character.id),
    },
    resourceRoots: catalog.policy.roots,
    readableExtensions: catalog.policy.readableExtensions,
    fileCount: catalog.fileCount,
    files: catalog.files,
    resourceFiles: catalog.files,
  }
}

function allowedResourcePaths(resourceManifest) {
  return new Set(asArray(resourceManifest.files ?? resourceManifest.resourceFiles).map((resource) => resource.path))
}

function normalizeResourcePlan(raw, resourceManifest, alreadyReadPaths = new Set(), options = {}) {
  const allowed = allowedResourcePaths(resourceManifest)
  const data = unwrapSuggestion(raw) ?? raw ?? {}
  const reads = pickArray(data, ['reads', 'files', 'resources', 'toolCalls', 'tool_calls'])
    .map((item) => {
      if (typeof item === 'string') return { path: item, reason: '' }
      return {
        path: String(item?.path ?? item?.file ?? item?.resource ?? ''),
        reason: String(item?.reason ?? item?.purpose ?? item?.why ?? ''),
      }
    })
    .filter((item) => allowed.has(item.path) && isReadableResourcePath(item.path) && !alreadyReadPaths.has(item.path))

  const uniqueReads = []
  const seen = new Set()
  for (const read of reads) {
    if (seen.has(read.path)) continue
    seen.add(read.path)
    uniqueReads.push(read)
  }

  return {
    round: options.round ?? 1,
    planSummary: String(data.planSummary ?? data.focus ?? data.reason ?? ''),
    readyToAnswer: Boolean(data.readyToAnswer ?? data.ready ?? data.enoughContext ?? data.done ?? false),
    stopReason: String(data.stopReason ?? data.reasoningSummary ?? data.reason ?? ''),
    reads: uniqueReads,
  }
}

function readAgentResource(path) {
  if (!isReadableResourcePath(path)) {
    throw new Error(`Path is outside the readable project resource catalog: ${path}`)
  }
  const absolutePath = projectPathToAbsolute(path)
  const raw = readFileSync(absolutePath, 'utf8')
  if (path.endsWith('.json')) {
    return JSON.parse(raw)
  }
  return raw
}

function mergeInvestigatorRuntime(sheet, character) {
  if (!character) return sheet
  const next = deepClone(sheet)
  next.currentLocationId = character.locationId ?? character.location ?? next.currentLocationId
  next.status = {
    ...(next.status ?? {}),
    hp: { current: character.hp ?? next.status?.hp?.current, max: character.hpMax ?? next.status?.hp?.max },
    san: { current: character.san ?? next.status?.san?.current, max: character.sanMax ?? next.status?.san?.max },
    mp: { current: character.mp ?? next.status?.mp?.current },
    luck: character.luck ?? next.status?.luck,
    conditions: character.conditions ?? next.status?.conditions ?? [],
  }
  return next
}

function mergeNpcRuntime(sheet, character) {
  if (!character) return sheet
  const next = deepClone(sheet)
  next.currentStatus = character.conditions ?? next.currentStatus
  next.stats = {
    ...(next.stats ?? {}),
    hp: { current: character.hp ?? next.stats?.hp?.current, max: character.hpMax ?? next.stats?.hp?.max },
    san: { current: character.san ?? next.stats?.san?.current, max: character.sanMax ?? next.stats?.san?.max },
    mp: character.mp ?? next.stats?.mp,
    mov: character.mov ?? next.stats?.mov,
    skills: character.skills ?? next.stats?.skills,
    characteristics: character.characteristics ?? next.stats?.characteristics,
  }
  return next
}

function compactInvestigatorFromCampaign(character) {
  return {
    schemaVersion: 'kp-agent-investigator-runtime-fallback-v1',
    id: character.id,
    name: character.name,
    type: character.type,
    occupation: character.role,
    currentLocationId: character.locationId ?? character.location,
    status: {
      hp: { current: character.hp, max: character.hpMax },
      san: { current: character.san, max: character.sanMax },
      mp: { current: character.mp },
      luck: character.luck,
      conditions: character.conditions ?? [],
    },
    characteristics: character.characteristics,
    derived: { mov: character.mov, build: character.build, damageBonus: character.damageBonus },
    skills: topSkills(character.skills, 12),
    background: character.backstory,
    privateNotes: character.privateNotes,
  }
}

function compactNpcFromCampaign(character) {
  return {
    schemaVersion: 'kp-agent-npc-runtime-fallback-v1',
    id: character.id,
    name: character.name,
    type: character.type,
    role: character.role,
    currentStatus: character.conditions ?? [],
    publicProfile: character.publicNotes ?? character.role,
    keeperProfile: { notes: character.privateNotes },
    stats: {
      characteristics: character.characteristics,
      hp: { current: character.hp, max: character.hpMax },
      san: { current: character.san, max: character.sanMax },
      mp: character.mp,
      mov: character.mov,
      skills: character.skills,
    },
  }
}

function syncModuleStateFromCampaign(moduleState, campaign = {}) {
  const next = deepClone(moduleState)
  const runtime = (next.runtime ??= {})
  const sceneIds = new Set(asArray(next.scenes).map((scene) => scene.id))
  const campaignSceneId = campaign.currentSceneId
  if (campaignSceneId && sceneIds.has(campaignSceneId)) {
    runtime.currentSceneId = campaignSceneId
  }

  const currentScene = asArray(next.scenes).find((scene) => scene.id === runtime.currentSceneId)
  if (currentScene && !asArray(currentScene.locationIds).includes(runtime.currentLocationId)) {
    runtime.currentLocationId = currentScene.defaultLocationId
  }

  const activeInvestigatorIds = asArray(campaign.characters)
    .filter((character) => character.type === 'investigator')
    .map((character) => character.id)
  if (activeInvestigatorIds.length) runtime.activeInvestigatorIds = activeInvestigatorIds

  if (campaign.storyGraph?.nodeStatuses) {
    runtime.nodeStatuses = { ...(runtime.nodeStatuses ?? {}), ...campaign.storyGraph.nodeStatuses }
  }

  if (campaign.storyGraph?.clueStates) {
    runtime.clueStates = { ...(runtime.clueStates ?? {}), ...campaign.storyGraph.clueStates }
  }

  for (const clue of asArray(campaign.clues)) {
    if (runtime.clueStates && Object.prototype.hasOwnProperty.call(runtime.clueStates, clue.id)) {
      runtime.clueStates[clue.id] = clue.status
    }
  }

  const campaignClocks = asArray(campaign.clocks)
  if (campaignClocks.length && Array.isArray(next.pressureClocks)) {
    next.pressureClocks = next.pressureClocks.map((clock, index) => {
      const matchingClock = campaignClocks.find((item) => item.id === clock.id) ?? campaignClocks[index]
      if (!matchingClock) return clock
      return {
        ...clock,
        current: Number(matchingClock.current ?? clock.current),
        max: Number(matchingClock.max ?? clock.max),
      }
    })
  }

  runtime.updatedAt = new Date().toISOString()

  try {
    writeJsonFile(LIAOQIE_MODULE_STATE_PATH, serializeRuntimeModuleState(next))
  } catch {
    // Runtime persistence is useful, but context assembly should still work if the file is temporarily locked.
  }

  return next
}

function inferRequestedLocationIds(action) {
  const text = String(action ?? '')
  const ids = new Set()

  if (/楼下|公寓楼下|门口|聚集|集合|抵达|入口|警戒线/.test(text)) ids.add('loc-resnick-apartment-exterior')
  if (/上楼|进入|房间|屋内|室内|尸体|尸检|黑舌|瓶子|小玻璃瓶/.test(text)) ids.add('loc-resnick-room')
  if (/验尸官|尸检报告|司法科学/.test(text)) ids.add('loc-coroner-office')
  if (/校园|学生|校报|教授|安保/.test(text)) ids.add('loc-campus')
  if (/实验|检验|化学|药学|黑血|样本/.test(text)) ids.add('loc-lab-or-clinic')
  if (/市政|档案|记录|报纸|税务/.test(text)) ids.add('loc-city-records')
  if (/罗杰斯.*住|小屋|住处/.test(text)) ids.add('loc-rogers-house')
  if (/夜间|街道|死从天降|夜魇/.test(text)) ids.add('loc-night-street')
  if (/多佛公寓|日志|乔纳森/.test(text)) ids.add('loc-dover-apartment')
  if (/屠宰场|处理厂|终局|摊牌/.test(text)) ids.add('loc-slaughterhouse')

  return [...ids]
}

function findById(items, id) {
  return asArray(items).find((item) => item.id === id)
}

function locationWithScopedClues(location, moduleState, includeClueDetails) {
  const runtimeClueStates = moduleState.runtime?.clueStates ?? {}
  const clues = asArray(location.clueIds).map((clueId) => {
    const clue = findById(moduleState.clues, clueId)
    if (!clue) return { id: clueId, state: runtimeClueStates[clueId] ?? 'unknown' }
    const state = runtimeClueStates[clue.id] ?? clue.initialState ?? 'hidden'
    if (!includeClueDetails) {
      return { id: clue.id, state, locationId: clue.locationId }
    }
    return {
      id: clue.id,
      title: clue.title,
      state,
      locationId: clue.locationId,
      publicText: state === 'revealed' || state === 'available' ? clue.publicText : undefined,
      keeperText: clue.keeperText,
      relatedNpcIds: clue.relatedNpcIds ?? [],
      unlockSceneIds: clue.unlockSceneIds ?? [],
      unlockLocationIds: clue.unlockLocationIds ?? [],
    }
  })

  return {
    id: location.id,
    sceneId: location.sceneId,
    title: location.title,
    access: location.access,
    publicDescription: location.publicDescription,
    keeperFocus: location.keeperFocus,
    visibleFeatures: location.visibleFeatures ?? [],
    defaultChecks: location.defaultChecks ?? [],
    npcIds: location.npcIds ?? [],
    nextLocationIds: location.nextLocationIds ?? [],
    clues,
  }
}

function buildRuntimeModuleContext(moduleState, action) {
  const runtime = moduleState.runtime ?? {}
  const currentScene = findById(moduleState.scenes, runtime.currentSceneId) ?? asArray(moduleState.scenes)[0]
  const requestedLocationIds = inferRequestedLocationIds(action)
  const selectedLocationIds = [
    ...new Set([runtime.currentLocationId ?? currentScene?.defaultLocationId, ...requestedLocationIds].filter(Boolean)),
  ]
  const selectedLocationSet = new Set(selectedLocationIds)
  const selectedLocations = asArray(moduleState.locations)
    .filter((location) => selectedLocationSet.has(location.id))
    .map((location) => locationWithScopedClues(location, moduleState, true))

  const sceneLocations = asArray(currentScene?.locationIds)
    .map((locationId) => findById(moduleState.locations, locationId))
    .filter(Boolean)
    .map((location) =>
      selectedLocationSet.has(location.id)
        ? locationWithScopedClues(location, moduleState, true)
        : {
            id: location.id,
            sceneId: location.sceneId,
            title: location.title,
            access: location.access,
            state: moduleState.runtime?.locationStates?.[location.id] ?? 'unknown',
            nextLocationIds: location.nextLocationIds ?? [],
          },
    )

  const outgoingEdges = asArray(moduleState.storyGraph?.edges)
    .filter((edge) => edge.from === currentScene?.id)
    .map((edge) => ({
      ...edge,
      toTitle: findById(moduleState.scenes, edge.to)?.title,
      toStatus: moduleState.runtime?.nodeStatuses?.[edge.to],
    }))

  const locationStates = runtime.locationStates ?? {}
  const nodeStatuses = runtime.nodeStatuses ?? {}

  return {
    schemaVersion: 'kp-agent-runtime-module-context-v1',
    moduleId: moduleState.moduleId,
    title: moduleState.title,
    sourceFiles: {
      moduleTemplate: 'app/server/data/kp-agent/liaoque_huanmeng/module_template.json',
      moduleState: 'app/server/data/kp-agent/liaoque_huanmeng/module_state.json',
      investigatorIndex: 'app/server/data/kp-agent/liaoque_huanmeng/investigators/index.json',
      npcIndex: 'app/server/data/kp-agent/liaoque_huanmeng/npcs/index.json',
      moduleSourceText: 'documents/runtime/liaoque_huanmeng/source_text.md',
    },
    runtime: {
      phase: runtime.phase,
      currentSceneId: runtime.currentSceneId,
      currentLocationId: runtime.currentLocationId,
      selectedLocationIds,
      activeInvestigatorIds: runtime.activeInvestigatorIds ?? [],
      loadedNpcIds: runtime.loadedNpcIds ?? [],
    },
    currentScene: currentScene
      ? {
          id: currentScene.id,
          title: currentScene.title,
          kind: currentScene.kind,
          phase: currentScene.phase,
          purposeForKeeper: currentScene.purposeForKeeper,
          publicPremise: currentScene.publicPremise,
          status: nodeStatuses[currentScene.id] ?? 'unknown',
          defaultLocationId: currentScene.defaultLocationId,
          completionSignals: currentScene.completionSignals ?? [],
        }
      : undefined,
    currentSceneLocations: sceneLocations,
    selectedLocations,
    navigation: {
      outgoingEdges,
      locationStates: Object.fromEntries(
        Object.entries(locationStates).filter(([locationId]) => asArray(currentScene?.locationIds).includes(locationId)),
      ),
      nodeStatuses,
    },
    pressureClocks: asArray(moduleState.pressureClocks).map((clock) => ({
      id: clock.id,
      title: clock.title,
      current: clock.current,
      max: clock.max,
      consequence: Number(clock.current ?? 0) > 0 ? clock.consequence : undefined,
    })),
    keeperTables: moduleState.keeperTables,
  }
}

function selectNpcIds({ moduleContext, npcIndex, action }) {
  const ids = new Set(moduleContext.runtime.loadedNpcIds ?? [])
  for (const location of moduleContext.selectedLocations ?? []) {
    for (const npcId of location.npcIds ?? []) ids.add(npcId)
  }

  const text = String(action ?? '')
  for (const record of asArray(npcIndex.files)) {
    if (record.name && text.includes(record.name)) ids.add(record.id)
  }

  return [...ids]
}

function buildSelectedCharacterContext({ campaign, moduleState, investigatorIndex, npcIndex, moduleContext, action }) {
  const campaignCharacters = asArray(campaign.characters)
  const campaignById = new Map(campaignCharacters.map((character) => [character.id, character]))
  const investigatorRecords = new Map(asArray(investigatorIndex.files).map((record) => [record.id, record]))
  const npcRecords = new Map(asArray(npcIndex.files).map((record) => [record.id, record]))
  const activeInvestigatorIds =
    moduleState.runtime?.activeInvestigatorIds?.length
      ? moduleState.runtime.activeInvestigatorIds
      : campaignCharacters.filter((character) => character.type === 'investigator').map((character) => character.id)

  const selectedInvestigators = activeInvestigatorIds
    .map((id) => {
      const fileSheet = readIndexedFile(investigatorRecords.get(id))
      const campaignCharacter = campaignById.get(id)
      if (fileSheet) return mergeInvestigatorRuntime(fileSheet, campaignCharacter)
      if (campaignCharacter) return compactInvestigatorFromCampaign(campaignCharacter)
      return undefined
    })
    .filter(Boolean)

  const selectedNpcIds = selectNpcIds({ moduleContext, npcIndex, action })
  const selectedNpcs = selectedNpcIds
    .map((id) => {
      const fileSheet = readIndexedFile(npcRecords.get(id))
      const campaignCharacter = campaignById.get(id)
      if (fileSheet) return mergeNpcRuntime(fileSheet, campaignCharacter)
      if (campaignCharacter) return compactNpcFromCampaign(campaignCharacter)
      return undefined
    })
    .filter(Boolean)

  return {
    selectedInvestigators,
    selectedNpcs,
    selectedFiles: [
      'app/server/data/kp-agent/liaoque_huanmeng/module_state.json',
      ...selectedInvestigators.map((item) => `investigator:${item.id}`),
      ...selectedNpcs.map((item) => `npc:${item.id}`),
    ],
  }
}

function assembleCleanContext({ payload }) {
  const campaign = payload.campaign ?? {}
  const bundle = payload.kpAgentContext ?? {}
  const agentContext = bundle.agentContext ?? payload.agentContext ?? {}
  const { moduleState, investigatorIndex, npcIndex } = loadAgentResourcePack()
  const syncedModuleState = syncModuleStateFromCampaign(moduleState, campaign)
  const resourceManifest = buildResourceManifest({
    moduleState: syncedModuleState,
    investigatorIndex,
    npcIndex,
    campaign,
  })

  const contextPack = {
    intent: classifyAgentIntentFromText(payload.action),
    keeperRequest: String(payload.action ?? ''),
    rulesBrief: buildRulesBrief(),
    resourceManifest,
    currentRun: buildCompactRunSnapshot(campaign, agentContext),
  }

  return {
    intent: contextPack.intent,
    contextPack,
    ...trace('assemble_context', {
      intent: contextPack.intent,
      currentSceneId: resourceManifest.runtimeSnapshot.currentScene?.id,
      currentLocationId: resourceManifest.runtimeSnapshot.currentLocation?.id,
      resourceCount: resourceManifest.files.length,
      investigatorCount: contextPack.currentRun.investigators.length,
    }),
  }
}


function buildResourceLoopMessages({ contextPack, resourcePlans = [], toolResults = [], round = 1 }) {
  const system = buildKeeperSystemPrompt()
  const readFiles = asArray(toolResults).map((result) => result.path)
  const input = {
    keeperRequest: contextPack.keeperRequest,
    intent: contextPack.intent,
    currentRun: contextPack.currentRun,
    resourceManifest: contextPack.resourceManifest,
    previousPlans: resourcePlans,
    alreadyReadFiles: readFiles,
    alreadyReadResults: toolResults,
  }
  const user = [
    `资料阅读循环第 ${round} 轮：请判断当前资料是否已经足够完成本轮 KP 请求。`,
    '如果已经足够，请输出 readyToAnswer: true，并说明 stopReason；reads 必须为空数组。',
    '如果还不够，请输出 readyToAnswer: false，并追加读取你认为必要、尚未读取过的文件。',
    '请输出 JSON：{ "readyToAnswer": boolean, "planSummary": "...", "stopReason": "...", "reads": [ { "path": "...", "reason": "..." } ] }。',
    'path 必须从 resourceManifest.files[].path 中选择；这些文件来自 docs、规则书 Markdown、模组原文与 resources 资料目录。',
    '不要重复读取 alreadyReadFiles 中的文件；如果没有新的必要文件，也应 readyToAnswer: true。',
    'INPUT:',
    safeJson(input, 300_000),
  ].join('\n')

  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    ...trace('build_resource_loop_messages', {
      round,
      systemChars: system.length,
      userChars: user.length,
      resourceCount: contextPack.resourceManifest.files.length,
      alreadyReadCount: readFiles.length,
    }),
  }
}

function readAgentResources({ rawSuggestion, contextPack, toolResults = [], round = 1 }) {
  const alreadyReadPaths = new Set(asArray(toolResults).map((result) => result.path))
  const resourcePlan = normalizeResourcePlan(rawSuggestion, contextPack.resourceManifest, alreadyReadPaths, {
    round,
  })
  const nextToolResults = resourcePlan.reads.map((read) => {
    try {
      return {
        path: read.path,
        reason: read.reason,
        ok: true,
        content: readAgentResource(read.path),
      }
    } catch (error) {
      return {
        path: read.path,
        reason: read.reason,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown read error',
      }
    }
  })

  return {
    resourcePlan,
    toolResults: nextToolResults,
    ...trace('read_agent_resources', {
      round,
      readyToAnswer: resourcePlan.readyToAnswer,
      requested: resourcePlan.reads.map((read) => read.path),
      readCount: nextToolResults.filter((result) => result.ok).length,
      failedCount: nextToolResults.filter((result) => !result.ok).length,
    }),
  }
}

function buildLoopFinalMessages({ contextPack, resourcePlan, resourcePlans = [], toolResults = [] }) {
  const system = buildKeeperSystemPrompt()
  const input = {
    keeperRequest: contextPack.keeperRequest,
    intent: contextPack.intent,
    cocRulesBrief: contextPack.rulesBrief,
    currentRun: contextPack.currentRun,
    resourcePlan,
    resourcePlans,
    toolResults,
  }
  const user = [
    '最终回答：你已经完成自主资料阅读循环。请只基于当前团状态、COC7 规则摘要和已读取资料完成 KP 建议。',
    '如果资料仍然不足，请在 riskWarnings 里说明缺口，不要编造未读取或未确认的信息。',
    '顶层 JSON 必须只包含这些字段：situationSummary, nextMoves, checks, clueTriggers, npcReactions, riskWarnings, proposedChanges, sources。',
    '字段含义：',
    '- situationSummary: string，可以直接说给玩家的话。',
    '- nextMoves: string[]，KP 私密主持思路，最多 5 条。',
    '- checks: array，每项包含 label, skill, difficulty, reason, optional targetCharacterId。',
    '- clueTriggers: string[]，可能被触发、但需要 KP 确认的线索或状态变化。',
    '- npcReactions: string[]，NPC 的私密反应或可扮演要点。',
    '- riskWarnings: string[]，节奏、剧透、规则或状态风险提醒。',
    '- proposedChanges: array，每项包含 label, detail, kind, optional targetId；kind 只能是 reveal_clue, advance_clock, add_log。',
    '- sources: array，每项包含 label, path。',
    'INPUT:',
    safeJson(input, 320_000),
  ].join('\n')

  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    ...trace('build_final_messages', {
      systemChars: system.length,
      userChars: user.length,
      readFiles: asArray(toolResults).map((result) => result.path),
      resourceRounds: resourcePlans.length,
    }),
  }
}

async function callDeepseek({ messages, options }) {
  if (!options.apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY')
  }

  const model = options.agentModel ?? options.model ?? DEFAULT_AGENT_MODEL
  const thinkingMode = options.thinkingMode ?? 'disabled'
  const requestBody = {
    model,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.35,
    max_tokens: Number(options.maxTokens ?? 2400),
  }

  if (thinkingMode !== 'omit') {
    requestBody.thinking = { type: thinkingMode }
  }

  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${detail.slice(0, 500)}`)
  }

  const completion = await response.json()
  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek response did not include message content')

  return {
    rawSuggestion: JSON.parse(stripCodeFence(content)),
    ...trace('call_model', {
      provider: 'deepseek',
      model,
      thinkingMode,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
    }),
  }
}

async function runResourceReadingLoop({ contextPack, options }) {
  const resourcePlans = []
  const toolResults = []
  const loopTrace = []
  let resourcePlan = {
    round: 0,
    planSummary: '尚未读取资料。',
    readyToAnswer: false,
    stopReason: '',
    reads: [],
  }

  for (let round = 1; ; round += 1) {
    const messageBuild = buildResourceLoopMessages({
      contextPack,
      resourcePlans,
      toolResults,
      round,
    })
    loopTrace.push(...messageBuild.trace)

    const modelResult = await callDeepseek({ messages: messageBuild.messages, options })
    loopTrace.push(...modelResult.trace.map((item) => ({ ...item, node: `resource_loop.${item.node}` })))

    const readResult = readAgentResources({
      rawSuggestion: modelResult.rawSuggestion,
      contextPack,
      toolResults,
      round,
    })
    resourcePlan = readResult.resourcePlan
    resourcePlans.push(resourcePlan)
    toolResults.push(...readResult.toolResults)
    loopTrace.push(...readResult.trace)

    const noNewReads = resourcePlan.reads.length === 0
    if (resourcePlan.readyToAnswer || noNewReads) {
      loopTrace.push(
        ...trace('resource_loop_stop', {
          round,
          readyToAnswer: resourcePlan.readyToAnswer,
          noNewReads,
          stopReason: resourcePlan.stopReason,
          totalReadCount: toolResults.length,
        }).trace,
      )
      break
    }
  }

  return {
    resourcePlan,
    resourcePlans,
    toolResults,
    trace: loopTrace,
  }
}

function normalizeDifficulty(value) {
  return ['regular', 'hard', 'extreme'].includes(value) ? value : 'regular'
}

function normalizeProposedKind(value) {
  return ['reveal_clue', 'advance_clock', 'add_log'].includes(value) ? value : 'add_log'
}

function normalizeSuggestion(raw, campaign = {}) {
  const data = unwrapSuggestion(raw) ?? {}
  const characters = asArray(campaign.characters)
  const fallbackCharacter =
    characters.find((character) => character.type === 'investigator')?.id ?? characters[0]?.id ?? ''
  const currentCharacterIds = new Set(characters.map((character) => character.id))
  const safeCharacterId = (targetCharacterId) =>
    targetCharacterId && currentCharacterIds.has(targetCharacterId) ? targetCharacterId : fallbackCharacter

  const situationSummary = pickValue(
    data,
    [
      'situationSummary',
      'situation_summary',
      'playerVisibleText',
      'player_visible_text',
      'readAloud',
      'read_aloud',
      'narration',
      'opening',
      'summary',
      '玩家可见文本',
      '可朗读文本',
      '开场白',
    ],
    'KP Agent 已生成建议，但缺少可朗读文本。'
  )
  const checks = pickArray(data, ['checks', 'suggestedChecks', 'suggested_checks', 'rolls', 'skillChecks', '检定建议'])
  const proposedChanges = pickArray(data, [
    'proposedChanges',
    'proposed_changes',
    'stateChanges',
    'state_changes',
    'changes',
    '待确认变更',
  ])
  const sources = pickArray(data, ['sources', 'references', '依据', '来源'])

  return {
    id: randomUUID(),
    situationSummary: String(situationSummary),
    nextMoves: pickArray(data, ['nextMoves', 'next_moves', 'keeperNotes', 'keeper_notes', 'kpNotes', 'kp_notes', '主持建议', 'KP私密建议'])
      .map(stringifyListItem)
      .filter(Boolean)
      .slice(0, 5),
    checks: checks
      .slice(0, 4)
      .map((check) => ({
        id: randomUUID(),
        skill: check?.skill ?? 'spot_hidden',
        label: String(check?.label ?? '建议检定'),
        targetCharacterId: safeCharacterId(check?.targetCharacterId),
        difficulty: normalizeDifficulty(check?.difficulty),
        reason: stringifyListItem(check?.reason ?? check),
      })),
    clueTriggers: pickArray(data, ['clueTriggers', 'clue_triggers', 'clues', 'clueSuggestions', '线索触发'])
      .map(stringifyListItem)
      .filter(Boolean)
      .slice(0, 5),
    npcReactions: pickArray(data, ['npcReactions', 'npc_reactions', 'npcNotes', 'npc_notes', 'NPC反应'])
      .map(stringifyListItem)
      .filter(Boolean)
      .slice(0, 5),
    riskWarnings: pickArray(data, ['riskWarnings', 'risk_warnings', 'warnings', 'risks', '风险提醒'])
      .map(stringifyListItem)
      .filter(Boolean)
      .slice(0, 5),
    proposedChanges: proposedChanges
      .slice(0, 4)
      .map((change) => ({
        id: randomUUID(),
        label: String(change?.label ?? '待确认变更'),
        detail: stringifyListItem(change?.detail ?? change),
        kind: normalizeProposedKind(change?.kind),
        targetId: change?.targetId,
      })),
    sources: sources.length
      ? sources
          .slice(0, 6)
          .map((source) => ({
            label: String(source?.label ?? 'KP Agent Harness'),
            path: String(source?.path ?? 'agent/harness'),
          }))
      : [
          { label: '完整模组', path: 'kpAgentContext.moduleContext.sourceText' },
          { label: '当前团状态', path: 'kpAgentContext.agentContext' },
          { label: 'COC7 规则摘要', path: 'server/kp-agent-harness.mjs#rulesBrief' },
        ],
  }
}

function normalizeResult({ rawSuggestion, payload }) {
  const unwrapped = unwrapSuggestion(rawSuggestion) ?? {}
  return {
    suggestion: normalizeSuggestion(rawSuggestion, payload.campaign),
    ...trace('normalize_result', {
      rawKeys: rawSuggestion && typeof rawSuggestion === 'object' ? Object.keys(rawSuggestion).slice(0, 12) : [],
      unwrappedKeys: unwrapped && typeof unwrapped === 'object' ? Object.keys(unwrapped).slice(0, 12) : [],
      hasChecks: pickArray(unwrapped, ['checks', 'suggestedChecks', 'suggested_checks', 'rolls', 'skillChecks', '检定建议']).length,
      hasProposedChanges: pickArray(unwrapped, ['proposedChanges', 'proposed_changes', 'stateChanges', 'state_changes', 'changes', '待确认变更']).length,
    }),
  }
}

const kpAgentGraph = new StateGraph(KpAgentState)
  .addNode('assemble_context', assembleCleanContext)
  .addNode('run_resource_reading_loop', runResourceReadingLoop)
  .addNode('build_final_messages', buildLoopFinalMessages)
  .addNode('call_final_model', callDeepseek)
  .addNode('normalize_result', normalizeResult)
  .addEdge(START, 'assemble_context')
  .addEdge('assemble_context', 'run_resource_reading_loop')
  .addEdge('run_resource_reading_loop', 'build_final_messages')
  .addEdge('build_final_messages', 'call_final_model')
  .addEdge('call_final_model', 'normalize_result')
  .addEdge('normalize_result', END)
  .compile()

export async function createKpAgentSuggestion(payload, options) {
  const result = await kpAgentGraph.invoke({
    payload,
    options: {
      ...options,
      baseUrl: options.baseUrl ?? 'https://api.deepseek.com',
      agentModel: options.agentModel ?? DEFAULT_AGENT_MODEL,
    },
  })

  return {
    suggestion: result.suggestion,
    trace: result.trace,
    harness: {
      framework: 'LangGraph.js',
      pattern: 'autonomous multi-round resource-reading loop',
      model: options.agentModel ?? DEFAULT_AGENT_MODEL,
      intent: result.intent,
      resourcePlan: result.resourcePlan,
      resourcePlans: result.resourcePlans,
      readFiles: asArray(result.toolResults).map((item) => item.path),
    },
  }
}

export function syncLiaoqieModuleStateFromCampaign(campaign = {}) {
  const { moduleState } = loadAgentResourcePack()
  const syncedModuleState = syncModuleStateFromCampaign(moduleState, campaign)
  return {
    ok: true,
    moduleId: syncedModuleState.moduleId,
    currentSceneId: syncedModuleState.runtime?.currentSceneId,
    currentLocationId: syncedModuleState.runtime?.currentLocationId,
    activeInvestigatorIds: syncedModuleState.runtime?.activeInvestigatorIds ?? [],
    updatedAt: syncedModuleState.runtime?.updatedAt,
  }
}

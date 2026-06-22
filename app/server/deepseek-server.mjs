import http from 'node:http'
import { createKpAgentSuggestion, syncLiaoqieModuleStateFromCampaign } from './kp-agent-harness.mjs'
import { createPlayerAgentRound } from './player-agent-harness.mjs'

const PORT = Number(process.env.KP_AGENT_API_PORT ?? 8787)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const DEEPSEEK_AGENT_MODEL = process.env.DEEPSEEK_AGENT_MODEL ?? 'deepseek-v4-pro'
const DEEPSEEK_PLAYER_MODEL = process.env.DEEPSEEK_PLAYER_MODEL ?? DEEPSEEK_AGENT_MODEL
const DEEPSEEK_AGENT_THINKING = process.env.DEEPSEEK_AGENT_THINKING ?? 'disabled'
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
const MAX_REQUEST_CHARS = 5_000_000

const simulatedPlayerProfiles = [
  {
    id: 'sim-player-a',
    label: '模拟玩家A',
    style: '主动调查型。你会推进场景，明确提出观察、询问、搜索或移动，但不会替 KP 宣布结果。',
  },
  {
    id: 'sim-player-b',
    label: '模拟玩家B',
    style: '谨慎辅助型。你会补充安全措施、照看队友、质疑异常细节，偶尔提出保守但有用的行动。',
  },
]

function sendJson(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://127.0.0.1:5173',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  })
  res.end(data)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > MAX_REQUEST_CHARS) {
        reject(new Error('Request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function buildFallbackAgentContext(campaign) {
  const currentScene = campaign.scenes.find((scene) => scene.id === campaign.currentSceneId) ?? campaign.scenes[0]
  const investigators = campaign.characters.filter((character) => character.type === 'investigator')

  return {
    schemaVersion: 'kp-agent-context-server-fallback',
    campaignName: campaign.campaignName,
    moduleName: campaign.moduleName,
    partySummary: {
      investigatorCount: investigators.length,
      activeInvestigatorIds: investigators.map((character) => character.id),
      investigators: investigators.map((character) => ({
        id: character.id,
        name: character.name,
        role: character.role,
        hp: `${character.hp}/${character.hpMax}`,
        san: `${character.san}/${character.sanMax}`,
        luck: character.luck,
        skills: character.skills,
        conditions: character.conditions,
      })),
      removedInvestigators: campaign.logs
        .filter((log) => /^删除调查员：/.test(log.content))
        .slice(0, 8)
        .map((log) => ({
          name: log.content.replace(/^删除调查员：/, '').split('。')[0],
          time: log.time,
          logId: log.id,
        })),
    },
    currentScene,
    npcs: campaign.characters
      .filter((character) => character.type !== 'investigator')
      .map((character) => ({
        id: character.id,
        name: character.name,
        type: character.type,
        role: character.role,
        conditions: character.conditions,
        privateNotes: character.privateNotes,
      })),
    clues: campaign.clues.map((clue) => ({
      id: clue.id,
      title: clue.title,
      status: clue.status,
      content: clue.status === 'hidden' ? undefined : clue.content,
      revealHint: clue.revealHint,
    })),
    clocks: campaign.clocks,
    recentStateChanges: campaign.logs.filter((log) => log.type === 'state_change' || log.type === 'roll').slice(0, 8),
    recentPlayerActions: campaign.logs.filter((log) => log.type === 'player_action' || log.type === 'keeper_ruling').slice(0, 8),
    operatorHints: [
      `当前调查员数量：${investigators.length}`,
      '不要引用已删除调查员作为行动目标或检定目标。',
    ],
  }
}

function buildPrompt({ action, campaign, agentContext, kpAgentContext }) {
  const contextBundle =
    kpAgentContext ??
    {
      schemaVersion: 'kp-agent-request-context-server-fallback',
      moduleContext: undefined,
      agentContext: agentContext ?? buildFallbackAgentContext(campaign),
      budget: undefined,
    }

  return [
    {
      role: 'system',
      content:
        '你是 COC7 跑团主持人 KP 的对话式副驾驶。你将收到 kpAgentContext：唯一模组原文入口、后端运行数据、当前团状态、短期原文记录和长期摘要。模组原文是模组事实来源；本局已经发生了什么，必须以 agentContext 的当前团状态、storyProgress、currentClues 和日志为准。你根据 KP 的自然语言意图给出可直接使用的主持材料、私密提醒、建议检定和待确认变化。你只给建议，不替 KP 做最终裁定。必须避免向玩家剧透，玩家可见文本只能包含玩家当前已知或眼前可见的信息，不能把 hidden 线索、未进入地点、未确认结果写成已经发生。只输出 JSON，不要输出 Markdown。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task:
          '基于 kpAgentContext 和 KP 的请求，生成一个 AssistantSuggestion JSON。字段必须包括 situationSummary, nextMoves, checks, clueTriggers, npcReactions, riskWarnings, proposedChanges, sources。字段含义：situationSummary=可以直接说给玩家的话；nextMoves=KP 私密说明和主持思路；checks=建议检定或规则处理，reason 写给 KP 看，不要公开完整成功/失败后果；clueTriggers=待确认状态变化或可能揭示的线索；npcReactions=NPC 私密反应；riskWarnings=主持守则提醒；proposedChanges=需要 KP 确认后应用的状态变更。proposedChanges.kind 必须从 reveal_clue, advance_clock, add_log 中选择。targetId 只能引用现有 clue 或 clock id。不要自动确认状态。必须显式遵守 kpAgentContext.agentContext.partySummary.investigatorCount、activeInvestigatorIds、storyProgress.currentSceneStatus、currentClues.revealed/currentClues.available；不要引用 removedInvestigators 里的调查员作为当前在场角色。若模组原文和当前团状态存在冲突，优先级为：当前团状态 > 模组原文。若当前场景线索仍为 hidden，除非 KP 明确说明玩家已经发现或进入相关地点，否则 situationSummary 不得直接描述该线索的具体内容。',
        keeperRequest: action,
        kpAgentContext: contextBundle,
      }),
    },
  ]
}

function normalizeSuggestion(raw, campaign) {
  const fallbackCharacter = campaign.characters.find((character) => character.type === 'investigator')?.id ?? campaign.characters[0]?.id ?? ''
  const currentCharacterIds = new Set(campaign.characters.map((character) => character.id))
  const safeCharacterId = (targetCharacterId) =>
    targetCharacterId && currentCharacterIds.has(targetCharacterId) ? targetCharacterId : fallbackCharacter

  return {
    id: crypto.randomUUID(),
    situationSummary: String(raw.situationSummary ?? 'DeepSeek 已返回建议，但摘要字段缺失。'),
    nextMoves: Array.isArray(raw.nextMoves) ? raw.nextMoves.map(String).slice(0, 5) : [],
    checks: Array.isArray(raw.checks)
      ? raw.checks.slice(0, 4).map((check) => ({
          id: crypto.randomUUID(),
          skill: check.skill ?? 'spot_hidden',
          label: String(check.label ?? '建议检定'),
          targetCharacterId: safeCharacterId(check.targetCharacterId),
          difficulty: check.difficulty ?? 'regular',
          reason: String(check.reason ?? 'DeepSeek 建议进行该检定。'),
        }))
      : [],
    clueTriggers: Array.isArray(raw.clueTriggers) ? raw.clueTriggers.map(String).slice(0, 5) : [],
    npcReactions: Array.isArray(raw.npcReactions) ? raw.npcReactions.map(String).slice(0, 5) : [],
    riskWarnings: Array.isArray(raw.riskWarnings) ? raw.riskWarnings.map(String).slice(0, 5) : [],
    proposedChanges: Array.isArray(raw.proposedChanges)
      ? raw.proposedChanges.slice(0, 4).map((change) => ({
          id: crypto.randomUUID(),
          label: String(change.label ?? '待确认变更'),
          detail: String(change.detail ?? '需要 KP 确认后应用。'),
          kind: change.kind ?? 'add_log',
          targetId: change.targetId,
        }))
      : [],
    sources: Array.isArray(raw.sources)
      ? raw.sources.slice(0, 6).map((source) => ({
          label: String(source.label ?? '团状态'),
          path: String(source.path ?? 'campaign/current-state'),
        }))
      : [{ label: '团状态', path: 'campaign/current-state' }],
  }
}

function normalizeBackstory(raw) {
  return {
    personalDescription: String(raw.personalDescription ?? raw.description ?? ''),
    ideology: String(raw.ideology ?? raw.ideologyBeliefs ?? ''),
    significantPeople: String(raw.significantPeople ?? ''),
    meaningfulLocations: String(raw.meaningfulLocations ?? ''),
    treasuredPossessions: String(raw.treasuredPossessions ?? ''),
    traits: String(raw.traits ?? ''),
    darkSecret: String(raw.darkSecret ?? raw.secret ?? ''),
    injuriesScars: String(raw.injuriesScars ?? ''),
    phobiasManias: String(raw.phobiasManias ?? ''),
    investigatorExperiences: String(raw.investigatorExperiences ?? ''),
    mythosEncounters: String(raw.mythosEncounters ?? ''),
    spells: String(raw.spells ?? ''),
    allies: String(raw.allies ?? ''),
  }
}

function buildPlayerVisibleContext(campaign, character, visibleMessages, agentContext) {
  const currentScene = campaign.scenes.find((scene) => scene.id === campaign.currentSceneId) ?? campaign.scenes[0]
  return {
    partySummary: agentContext?.partySummary
      ? {
          investigatorCount: agentContext.partySummary.investigatorCount,
          activeInvestigatorIds: agentContext.partySummary.activeInvestigatorIds,
          investigators: agentContext.partySummary.investigators?.map((investigator) => ({
            id: investigator.id,
            name: investigator.name,
            role: investigator.role,
            hp: investigator.hp,
            san: investigator.san,
            conditions: investigator.conditions,
          })),
        }
      : undefined,
    currentScene: currentScene
      ? {
          title: currentScene.title,
          location: currentScene.location,
          summary: currentScene.summary,
          pressure: currentScene.pressure,
        }
      : undefined,
    ownCharacter: character
      ? {
          id: character.id,
          name: character.name,
          player: character.player,
          role: character.role,
          hp: `${character.hp}/${character.hpMax}`,
          san: `${character.san}/${character.sanMax}`,
          mp: character.mp,
          luck: character.luck,
          conditions: character.conditions,
          skills: character.skills,
          backstory: character.backstory,
        }
      : undefined,
    party: campaign.characters
      .filter((item) => item.type === 'investigator')
      .map((item) => ({
        id: item.id,
        name: item.name,
        role: item.role,
        hp: `${item.hp}/${item.hpMax}`,
        san: `${item.san}/${item.sanMax}`,
        conditions: item.conditions,
      })),
    revealedClues: campaign.clues
      .filter((clue) => clue.status === 'revealed')
      .map((clue) => ({
        title: clue.title,
        content: clue.content,
      })),
    publicChat: visibleMessages.slice(-12),
  }
}

function fallbackSimulatedLine(profile, character, context) {
  const name = character?.name ?? profile.label
  const sceneTitle = context.currentScene?.title ?? '当前场景'
  if (profile.id === 'sim-player-a') {
    return `我想先确认${sceneTitle}里最明显的异常点，尤其是入口、痕迹和有没有人刚刚来过。`
  }
  return `${name}会留意周围动静，同时提醒大家别分散太远，先确认有没有需要聆听或侦查的地方。`
}

function normalizeSimulatedLine(raw, profile, character, context) {
  const content = String(raw.content ?? raw.message ?? raw.action ?? '').trim()
  return content || fallbackSimulatedLine(profile, character, context)
}

async function createSimulatedPlayerLine({ campaign, profile, character, visibleMessages, agentContext }) {
  const context = buildPlayerVisibleContext(campaign, character, visibleMessages, agentContext)
  if (!DEEPSEEK_API_KEY) {
    return fallbackSimulatedLine(profile, character, context)
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content:
            '你正在扮演一名 COC 玩家进行本地测试。你只能根据玩家可见信息行动，不能知道隐藏线索、KP 私密信息、AI 给 KP 的建议或模组真相。不要替 KP 宣布结果，不要自行判定检定是否成功。只输出 JSON。',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task:
              '根据公开上下文，生成一句自然的玩家发言或行动声明。必须像真实玩家一样简洁，可以提问、描述行动或请求检定，但不能剧透、不能替 KP 下结论。输出 JSON：{ "content": "..." }。',
            playStyle: profile.style,
            visibleContext: context,
          }),
        },
      ],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: 0.75,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${detail.slice(0, 500)}`)
  }

  const completion = await response.json()
  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek response did not include message content')
  return normalizeSimulatedLine(JSON.parse(content), profile, character, context)
}

async function createSimulatedRound(payload) {
  const campaign = payload.campaign
  if (!campaign || !Array.isArray(campaign.characters)) {
    throw new Error('Missing campaign')
  }
  const agentContext = payload.kpAgentContext?.agentContext ?? payload.agentContext ?? buildFallbackAgentContext(campaign)

  const activeIds = new Set(agentContext.partySummary?.activeInvestigatorIds ?? [])
  const investigators = campaign.characters.filter(
    (character) => character.type === 'investigator' && (!activeIds.size || activeIds.has(character.id)),
  )
  const recentPublicMessages = [...(campaign.logs ?? [])]
    .reverse()
    .filter((log) => log.type === 'player_action' || log.type === 'keeper_ruling')
    .map((log) => ({
      speaker: log.speaker ?? (log.type === 'keeper_ruling' ? 'KP' : '玩家'),
      content: log.content,
      time: log.time,
    }))

  const messages = []
  const visibleMessages = [...recentPublicMessages]

  for (const [index, profile] of simulatedPlayerProfiles.entries()) {
    const character = investigators[index % Math.max(investigators.length, 1)]
    const content = await createSimulatedPlayerLine({
      campaign,
      profile,
      character,
      visibleMessages,
      agentContext,
    })
    const message = {
      id: crypto.randomUUID(),
      speaker: character?.player || profile.label,
      characterId: character?.id,
      content,
      type: 'player_action',
    }
    messages.push(message)
    visibleMessages.push({
      speaker: message.speaker,
      content: message.content,
      time: 'now',
    })
  }

  return { messages }
}

async function createSuggestion(payload) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('Missing DEEPSEEK_API_KEY')
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: buildPrompt(payload),
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: 0.4,
      max_tokens: 1600,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${detail.slice(0, 500)}`)
  }

  const completion = await response.json()
  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek response did not include message content')
  return normalizeSuggestion(JSON.parse(content), payload.campaign)
}

async function createBackstory(payload) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('Missing DEEPSEEK_API_KEY')
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content:
            '你是 COC7 调查员创建助手。根据职业、属性和时代氛围，为 KP 和玩家生成可用于跑团的人物背景。不要写规则书原文。只输出 JSON。',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task:
              '生成 backstory JSON，字段必须包括 personalDescription, ideology, significantPeople, meaningfulLocations, treasuredPossessions, traits, darkSecret, injuriesScars, phobiasManias, investigatorExperiences, mythosEncounters, spells, allies。字段对应 Excel 人物卡背景故事区：形象描述、思想与信念、重要之人、意义非凡之地、宝贵之物、特质、难言之隐、伤口和疤痕、恐惧症和躁狂症、调查员经历、神话相关、法术一览、调查员伙伴。内容要短、可直接放入人物卡，并提供可被 KP 使用的剧情钩子。',
            character: payload,
          }),
        },
      ],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: 0.65,
      max_tokens: 1600,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${detail.slice(0, 500)}`)
  }

  const completion = await response.json()
  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek response did not include message content')
  return normalizeBackstory(JSON.parse(content))
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {})
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
      agentHarness: 'LangGraph.js',
      agentModel: DEEPSEEK_AGENT_MODEL,
      playerModel: DEEPSEEK_PLAYER_MODEL,
      configured: Boolean(DEEPSEEK_API_KEY),
    })
    return
  }

  if (req.method === 'POST' && req.url === '/api/suggest') {
    try {
      const body = await readBody(req)
      const payload = JSON.parse(body)
      const suggestion = await createSuggestion(payload)
      sendJson(res, 200, { suggestion })
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown suggestion error',
      })
    }
    return
  }

  if (req.method === 'POST' && req.url === '/api/kp-agent') {
    try {
      const body = await readBody(req)
      const payload = JSON.parse(body)
      const result = await createKpAgentSuggestion(payload, {
        apiKey: DEEPSEEK_API_KEY,
        baseUrl: DEEPSEEK_BASE_URL,
        model: DEEPSEEK_MODEL,
        agentModel: DEEPSEEK_AGENT_MODEL,
        thinkingMode: DEEPSEEK_AGENT_THINKING,
      })
      sendJson(res, 200, result)
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown KP Agent harness error',
      })
    }
    return
  }

  if (req.method === 'POST' && req.url === '/api/module-state/sync') {
    try {
      const body = await readBody(req)
      const payload = JSON.parse(body)
      const result = syncLiaoqieModuleStateFromCampaign(payload.campaign ?? payload)
      sendJson(res, 200, result)
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown module state sync error',
      })
    }
    return
  }

  if (req.method === 'POST' && req.url === '/api/character-backstory') {
    try {
      const body = await readBody(req)
      const payload = JSON.parse(body)
      const backstory = await createBackstory(payload)
      sendJson(res, 200, { backstory })
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown backstory error',
      })
    }
    return
  }

  if (req.method === 'POST' && req.url === '/api/simulate/round') {
    try {
      const body = await readBody(req)
      const payload = JSON.parse(body)
      const round = await createPlayerAgentRound(
        {
          ...payload,
          playerProfiles: payload.playerProfiles ?? simulatedPlayerProfiles,
        },
        {
          apiKey: DEEPSEEK_API_KEY,
          baseUrl: DEEPSEEK_BASE_URL,
          agentModel: DEEPSEEK_AGENT_MODEL,
          playerModel: DEEPSEEK_PLAYER_MODEL,
          thinkingMode: DEEPSEEK_AGENT_THINKING,
        },
      )
      sendJson(res, 200, round)
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown player agent simulation error',
      })
    }
    return
  }

  sendJson(res, 404, { error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`COC KP Agent API listening on http://127.0.0.1:${PORT}`)
})

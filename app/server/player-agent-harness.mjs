import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { randomUUID } from 'node:crypto'

const DEFAULT_PLAYER_MODEL = 'deepseek-v4-pro'

const defaultPlayerProfiles = [
  {
    id: 'sim-player-a',
    label: '模拟玩家A',
    style: '主动调查型。优先提出观察、询问、搜索或移动，但不替 KP 宣布结果。',
  },
  {
    id: 'sim-player-b',
    label: '模拟玩家B',
    style: '谨慎辅助型。优先补充安全措施、照看队友、质疑异常细节。',
  },
]

const PlayerAgentState = Annotation.Root({
  payload: Annotation(),
  options: Annotation(),
  publicContext: Annotation(),
  messages: Annotation(),
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

function safeJson(value, maxChars = 80_000) {
  try {
    const text = JSON.stringify(value, null, 2)
    if (text.length <= maxChars) return text
    return `${text.slice(0, maxChars)}\n\n[TRUNCATED]`
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

function topSkills(skills = {}, limit = 8) {
  return Object.entries(skills)
    .filter(([, value]) => typeof value === 'number')
    .sort(([, left], [, right]) => right - left)
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }))
}

function publicCharacterSheet(character) {
  return {
    id: character.id,
    name: character.name,
    player: character.player,
    role: character.role,
    hp: `${character.hp ?? '-'} / ${character.hpMax ?? '-'}`,
    san: `${character.san ?? '-'} / ${character.sanMax ?? '-'}`,
    mp: character.mp,
    mov: character.mov,
    luck: character.luck,
    conditions: character.conditions ?? [],
    characteristics: character.characteristics,
    topSkills: topSkills(character.skills),
    background: character.backstory ?? character.background,
  }
}

function fallbackLine(profile, character, publicContext) {
  const name = character?.name ?? profile.label
  const sceneTitle = publicContext.currentScene?.title ?? '当前场景'
  if (profile.id === 'sim-player-a') {
    return `${name}先观察${sceneTitle}里最明显的异常点，尤其留意入口、痕迹和附近是否有人。`
  }
  return `${name}提醒大家先别分散，自己留意周围动静，并准备协助更擅长调查的人。`
}

function buildPublicContext({ payload }) {
  const campaign = payload.campaign ?? {}
  const agentContext = payload.kpAgentContext?.agentContext ?? payload.agentContext ?? {}
  const currentScene =
    asArray(campaign.scenes).find((scene) => scene.id === campaign.currentSceneId) ??
    agentContext.currentScene ??
    asArray(campaign.scenes)[0]
  const activeIds = new Set(agentContext.partySummary?.activeInvestigatorIds ?? [])
  const investigators = asArray(campaign.characters)
    .filter((character) => character.type === 'investigator' && (!activeIds.size || activeIds.has(character.id)))
    .map(publicCharacterSheet)

  const publicChat = asArray(campaign.logs)
    .filter((log) => log.type === 'player_action' || log.type === 'keeper_ruling')
    .slice(0, 20)
    .reverse()
    .map((log) => ({
      time: log.time,
      speaker: log.speaker ?? (log.type === 'keeper_ruling' ? 'KP' : '玩家'),
      characterId: log.characterId,
      content: log.content,
    }))

  const publicContext = {
    campaignName: campaign.campaignName,
    moduleName: campaign.moduleName,
    currentScene: currentScene
      ? {
          id: currentScene.id,
          title: currentScene.title,
          location: currentScene.location,
          publicSummary: payload.publicSceneSummary,
        }
      : undefined,
    investigators,
    revealedClues: asArray(campaign.clues)
      .filter((clue) => clue.status === 'revealed')
      .map((clue) => ({
        id: clue.id,
        title: clue.title,
        content: clue.content,
      })),
    publicChat,
  }

  return {
    publicContext,
    ...trace('build_public_context', {
      investigatorCount: investigators.length,
      publicChatCount: publicChat.length,
      revealedClueCount: publicContext.revealedClues.length,
    }),
  }
}

function normalizePlayerResponse(raw, profile, character, publicContext) {
  const data =
    raw?.message && typeof raw.message === 'object'
      ? raw.message
      : raw?.result && typeof raw.result === 'object'
        ? raw.result
        : raw
  const content = String(data?.content ?? data?.action ?? data?.speech ?? '').trim()
  return content || fallbackLine(profile, character, publicContext)
}

async function requestPlayerLine({ profile, character, publicContext, roundMessages, options }) {
  if (!options.apiKey) {
    return fallbackLine(profile, character, publicContext)
  }

  const system = [
    'You are a simulated Call of Cthulhu player agent for local testing.',
    'You only know public table information: public scene description, public chat, your own character sheet, party public status, and revealed clues.',
    'You must not use hidden module facts, KP private advice, unrevealed clues, or future plot knowledge.',
    'Do not narrate outcomes, do not decide success or failure, and do not change game state.',
    'Return JSON only. The player line must be in Simplified Chinese.',
  ].join('\n')

  const user = {
    task: 'Generate one concise player speech/action line for this round.',
    outputContract: { content: 'string' },
    playStyle: profile.style,
    actingAs: character,
    publicContext,
    previousMessagesThisRound: roundMessages,
  }

  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: options.playerModel ?? options.agentModel ?? DEFAULT_PLAYER_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: safeJson(user, 120_000) },
      ],
      response_format: { type: 'json_object' },
      thinking: { type: options.thinkingMode ?? 'disabled' },
      temperature: 0.75,
      max_tokens: Number(options.maxTokens ?? 520),
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${detail.slice(0, 500)}`)
  }

  const completion = await response.json()
  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek response did not include message content')
  return normalizePlayerResponse(JSON.parse(stripCodeFence(content)), profile, character, publicContext)
}

async function generateRound({ payload, publicContext, options }) {
  const profiles = asArray(payload.playerProfiles).length ? payload.playerProfiles : defaultPlayerProfiles
  const messages = []
  const roundMessages = []
  const investigators = publicContext.investigators

  for (const [index, profile] of profiles.entries()) {
    const character = investigators[index % Math.max(investigators.length, 1)]
    const content = await requestPlayerLine({
      profile,
      character,
      publicContext,
      roundMessages,
      options,
    })
    const message = {
      id: randomUUID(),
      speaker: character?.player || character?.name || profile.label,
      characterId: character?.id,
      content,
      type: 'player_action',
    }
    messages.push(message)
    roundMessages.push({
      speaker: message.speaker,
      characterId: message.characterId,
      content: message.content,
    })
  }

  return {
    messages,
    ...trace('generate_player_round', {
      profileCount: profiles.length,
      messageCount: messages.length,
      model: options.playerModel ?? options.agentModel ?? DEFAULT_PLAYER_MODEL,
    }),
  }
}

const playerAgentGraph = new StateGraph(PlayerAgentState)
  .addNode('build_public_context', buildPublicContext)
  .addNode('generate_player_round', generateRound)
  .addEdge(START, 'build_public_context')
  .addEdge('build_public_context', 'generate_player_round')
  .addEdge('generate_player_round', END)
  .compile()

export async function createPlayerAgentRound(payload, options) {
  const result = await playerAgentGraph.invoke({
    payload,
    options: {
      ...options,
      baseUrl: options.baseUrl ?? 'https://api.deepseek.com',
      playerModel: options.playerModel ?? options.agentModel ?? DEFAULT_PLAYER_MODEL,
    },
  })

  return {
    messages: result.messages,
    trace: result.trace,
    harness: {
      framework: 'LangGraph.js',
      role: 'player-agents',
      model: options.playerModel ?? options.agentModel ?? DEFAULT_PLAYER_MODEL,
    },
  }
}

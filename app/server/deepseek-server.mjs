import http from 'node:http'

const PORT = Number(process.env.KP_AGENT_API_PORT ?? 8787)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'

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
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function buildPrompt({ action, campaign }) {
  const compactState = {
    campaignName: campaign.campaignName,
    moduleName: campaign.moduleName,
    currentScene: campaign.scenes.find((scene) => scene.id === campaign.currentSceneId),
    investigators: campaign.characters
      .filter((character) => character.type === 'investigator')
      .map((character) => ({
        id: character.id,
        name: character.name,
        role: character.role,
        hp: `${character.hp}/${character.hpMax}`,
        san: `${character.san}/${character.sanMax}`,
        luck: character.luck,
        skills: character.skills,
        conditions: character.conditions,
      })),
    npcs: campaign.characters
      .filter((character) => character.type === 'npc')
      .map((character) => ({
        id: character.id,
        name: character.name,
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
    recentLogs: campaign.logs.slice(0, 8),
  }

  return [
    {
      role: 'system',
      content:
        '你是 COC7 跑团主持人 KP 的副驾驶。你只给建议，不替 KP 做最终裁定。必须避免剧透，必须区分已确认事实和推测。只输出 JSON，不要输出 Markdown。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task:
          '基于当前团状态和玩家行动，生成一个 AssistantSuggestion JSON。字段必须包括 situationSummary, nextMoves, checks, clueTriggers, npcReactions, riskWarnings, proposedChanges, sources。checks 里的 skill 必须从 spot_hidden, locksmith, library_use, listen, psychology, fast_talk, dodge, sanity, strength 中选择。proposedChanges.kind 必须从 reveal_clue, advance_clock, add_log 中选择。targetId 必须引用现有 clue 或 clock id。不要自动确认状态。',
        playerAction: action,
        compactState,
      }),
    },
  ]
}

function normalizeSuggestion(raw, campaign) {
  const fallbackCharacter = campaign.characters.find((character) => character.type === 'investigator')?.id ?? campaign.characters[0]?.id
  return {
    id: crypto.randomUUID(),
    situationSummary: String(raw.situationSummary ?? 'DeepSeek 已返回建议，但摘要字段缺失。'),
    nextMoves: Array.isArray(raw.nextMoves) ? raw.nextMoves.map(String).slice(0, 5) : [],
    checks: Array.isArray(raw.checks)
      ? raw.checks.slice(0, 4).map((check) => ({
          id: crypto.randomUUID(),
          skill: check.skill ?? 'spot_hidden',
          label: String(check.label ?? '建议检定'),
          targetCharacterId: check.targetCharacterId ?? fallbackCharacter,
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

  sendJson(res, 404, { error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`COC KP Agent API listening on http://127.0.0.1:${PORT}`)
})

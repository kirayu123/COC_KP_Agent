import { useMemo, useState } from 'react'
import './App.css'
import { CharacterCreator } from './components/CharacterCreator'
import { DiceAdjudicator } from './components/DiceAdjudicator'
import { StoryGraphDemo } from './components/StoryGraphDemo'
import { openingSuggestion, seedCampaign } from './data/demo'
import { initialStoryGraphState } from './data/storyGraphDemo'
import { labelForSkill } from './rules/coc7'
import type { AssistantSuggestion, CampaignState, Character, CheckSuggestion, ProposedChange } from './types'

const STORAGE_KEY = 'coc-kp-agent-demo'

function isCharacterLike(value: unknown): value is Character {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'name' in value &&
      'skills' in value &&
      typeof (value as Character).skills === 'object',
  )
}

function normalizeCampaign(value: unknown): CampaignState {
  if (isCharacterLike(value)) {
    return {
      ...seedCampaign,
      characters: [value],
      suggestions: [openingSuggestion],
      storyGraph: {
        nodeStatuses: { ...initialStoryGraphState.nodeStatuses },
        clueStates: { ...initialStoryGraphState.clueStates },
      },
    }
  }

  const partial = value && typeof value === 'object' ? (value as Partial<CampaignState>) : {}
  return {
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
    storyGraph: partial.storyGraph ?? {
      nodeStatuses: { ...initialStoryGraphState.nodeStatuses },
      clueStates: { ...initialStoryGraphState.clueStates },
    },
  }
}

function loadCampaign(): CampaignState {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return normalizeCampaign(seedCampaign)
  try {
    const repaired = normalizeCampaign(JSON.parse(saved))
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
  const wantsDoor = /门|锁|撬|后门|open|lock/.test(lower)
  const wantsWait = /等|观察|听|巡逻|wait|listen/.test(lower)
  const wantsSearch = /找|查|观察|侦查|线索|search|spot/.test(lower)
  const currentScene = state.scenes.find((scene) => scene.id === state.currentSceneId) ?? state.scenes[0]
  const primaryPc = state.characters.find((character) => character.type === 'investigator') ?? state.characters[0]
  const secondPc = state.characters.find((character) => character.id !== primaryPc.id && character.type === 'investigator') ?? primaryPc

  const checks: CheckSuggestion[] = []
  const proposedChanges: ProposedChange[] = []

  if (wantsDoor) {
    checks.push({
      id: crypto.randomUUID(),
      skill: 'locksmith',
      label: '处理后门锁',
      targetCharacterId: secondPc.id,
      difficulty: 'regular',
      reason: '玩家行动直接针对门锁，检定结果会决定进入方式和是否留下痕迹。',
    })
    proposedChanges.push({
      id: crypto.randomUUID(),
      label: '揭示线索：新换的门锁',
      detail: '若检定成功，确认门锁近期被更换，并将该线索写入日志。',
      kind: 'reveal_clue',
      targetId: 'clue-new-lock',
    })
  }

  if (wantsWait) {
    checks.push({
      id: crypto.randomUUID(),
      skill: 'listen',
      label: '判断巡逻距离',
      targetCharacterId: primaryPc.id,
      difficulty: 'regular',
      reason: '等待或偷听会把重点转向守夜人的位置。',
    })
    proposedChanges.push({
      id: crypto.randomUUID(),
      label: '推进守夜人巡逻',
      detail: '等待会消耗时间，守夜人巡逻进度 +1。',
      kind: 'advance_clock',
      targetId: 'clock-guard',
    })
  }

  if (wantsSearch || checks.length === 0) {
    checks.push({
      id: crypto.randomUUID(),
      skill: 'spot_hidden',
      label: '搜索入口异常',
      targetCharacterId: primaryPc.id,
      difficulty: 'regular',
      reason: '当前场景的主要信息藏在门锁、泥水痕迹和巡逻节奏里。',
    })
  }

  return {
    id: crypto.randomUUID(),
    situationSummary: `玩家行动集中在“${action || '未输入行动'}”。当前场景是${currentScene.title}，最重要的是保持潜入节奏，同时不要提前暴露地下室异常。`,
    nextMoves: [
      wantsDoor ? '允许一次锁匠检定决定是否安静进入；失败时不要卡死剧情，改为推进巡逻压力。' : '先让玩家明确行动对象：门锁、窗户、守夜人或周边痕迹。',
      wantsWait ? '等待会换来更多信息，但应推进守夜人巡逻进度，制造时间压力。' : '若玩家犹豫，可用雨声、煤油灯光或脚步声推动他们做选择。',
      '任何成功都只揭示当前层级的信息，不提前透露地下室低语和港务医院借阅卡。',
    ],
    checks,
    clueTriggers: ['新换的门锁仍是当前最自然的第一条线索。', '如果进入阅览室，潮湿脚印会从隐藏变为可用。'],
    npcReactions: ['唐守夜会先靠近查看动静；除非玩家制造巨大声响，否则不会立刻报警。'],
    riskWarnings: ['避免让 AI 自动决定调查员是否被抓；这应由 KP 根据检定和玩家描述裁定。'],
    proposedChanges,
    sources: [
      { label: `场景：${currentScene.title}`, path: currentScene.sourceRef },
      { label: '本轮玩家行动', path: 'session/current-action' },
    ],
  }
}

function App() {
  const [campaign, setCampaign] = useState<CampaignState>(loadCampaign)
  const [activeView, setActiveView] = useState<'console' | 'story'>('console')
  const [action, setAction] = useState('玩家想撬开后门，并尽量不惊动守夜人。')
  const [isGenerating, setIsGenerating] = useState(false)
  const [providerStatus, setProviderStatus] = useState('DeepSeek ready')
  const [isCreatorOpen, setIsCreatorOpen] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)

  const currentScene = useMemo(
    () => campaign.scenes.find((scene) => scene.id === campaign.currentSceneId) ?? campaign.scenes[0],
    [campaign],
  )
  const latestSuggestion = campaign.suggestions[0]
  const selectedCharacter = selectedCharacterId ? campaign.characters.find((character) => character.id === selectedCharacterId) : undefined

  function updateCampaign(next: CampaignState) {
    setCampaign(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
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
          updateCampaign({
            ...campaign,
            characters: [...campaign.characters.filter((item) => item.id !== parsed.id), parsed],
          })
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
      campaignName: '',
      moduleName: '',
      characters: [],
      clues: [],
      clocks: [],
      logs: [],
      rolls: [],
      suggestions: [openingSuggestion],
      storyGraph: {
        nodeStatuses: { ...initialStoryGraphState.nodeStatuses },
        clueStates: { ...initialStoryGraphState.clueStates },
      },
    })
    setAction('')
  }

  async function requestAssistantSuggestion(trimmedAction: string) {
    const response = await fetch('http://127.0.0.1:8787/api/suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: trimmedAction, campaign }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? `Provider returned ${response.status}`)
    }
    const body = (await response.json()) as { suggestion: AssistantSuggestion }
    return body.suggestion
  }

  async function submitAction() {
    const trimmed = action.trim()
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

  function applyChange(change: ProposedChange) {
    const logs = [
      {
        id: crypto.randomUUID(),
        time: nowLabel(),
        type: 'state_change' as const,
        content: `KP 采纳：${change.label}。${change.detail}`,
        confirmed: true,
      },
      ...campaign.logs,
    ]
    const clues =
      change.kind === 'reveal_clue'
        ? campaign.clues.map((clue) => (clue.id === change.targetId ? { ...clue, status: 'revealed' as const } : clue))
        : campaign.clues
    const clocks =
      change.kind === 'advance_clock'
        ? campaign.clocks.map((clock) =>
            clock.id === change.targetId ? { ...clock, current: Math.min(clock.current + 1, clock.max) } : clock,
          )
        : campaign.clocks

    updateCampaign({ ...campaign, clues, clocks, logs })
  }

  function applyResourceCost(characterIds: string[], resource: 'hp' | 'san' | 'mp' | 'luck', amount: number) {
    if (!amount) return
    updateCampaign({
      ...campaign,
      characters: campaign.characters.map((character) => {
        if (!characterIds.includes(character.id)) return character
        if (resource === 'hp') return { ...character, hp: Math.max(0, character.hp - amount) }
        if (resource === 'san') return { ...character, san: Math.max(0, character.san - amount) }
        if (resource === 'mp') return { ...character, mp: Math.max(0, character.mp - amount) }
        return { ...character, luck: Math.max(0, character.luck - amount) }
      }),
    })
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">COC KP Agent demo</p>
          <h1>{campaign.campaignName}</h1>
        </div>
        <div className="topbar-actions">
          <span className="module-pill">{campaign.moduleName}</span>
          <span className="module-pill">{providerStatus}</span>
          <div className="view-switcher" aria-label="主视图切换">
            <button className={activeView === 'console' ? 'active' : ''} type="button" onClick={() => setActiveView('console')}>
              KP 控制台
            </button>
            <button className={activeView === 'story' ? 'active' : ''} type="button" onClick={() => setActiveView('story')}>
              剧情图谱
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
      ) : (
      <section className="workspace" aria-label="KP 跑团控制台">
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
              <button className="primary-button" type="button" onClick={submitAction} disabled={isGenerating}>
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

          <Panel title="待确认变更">
            <div className="change-stack">
              {latestSuggestion.proposedChanges.length ? (
                latestSuggestion.proposedChanges.map((change) => (
                  <article className="change-card" key={change.id}>
                    <div>
                      <h3>{change.label}</h3>
                      <p>{change.detail}</p>
                    </div>
                    <button type="button" onClick={() => applyChange(change)}>
                      采纳
                    </button>
                  </article>
                ))
              ) : (
                <p className="empty-note">当前建议没有需要自动变更的状态。</p>
              )}
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
      <CharacterCreator open={isCreatorOpen} onClose={() => setIsCreatorOpen(false)} onCreate={addCreatedCharacter} />
      {selectedCharacter && <CharacterDetail character={selectedCharacter} onClose={() => setSelectedCharacterId(null)} />}
    </main>
  )
}

function CharacterDetail(props: { character: Character; onClose: () => void }) {
  const { character } = props
  const topSkills = character.skillBreakdown
    ? [...character.skillBreakdown].sort((a, b) => b.final - a.final).slice(0, 12)
    : Object.entries(character.skills)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
        .slice(0, 12)
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

        <div className="detail-grid">
          <section>
            <h3>基础信息</h3>
            <dl className="detail-list">
              <Stat label="职业" value={character.role} />
              <Stat label="玩家" value={character.player || '-'} />
              <Stat label="年龄" value={character.age ?? '-'} />
              <Stat label="住地" value={character.residence || '-'} />
              <Stat label="HP" value={`${character.hp}/${character.hpMax}`} />
              <Stat label="SAN" value={`${character.san}/${character.sanMax}`} />
              <Stat label="MP" value={character.mp} />
              <Stat label="MOV" value={character.mov ?? '-'} />
              <Stat label="DB" value={character.damageBonus ?? '-'} />
              <Stat label="体格" value={character.build ?? '-'} />
            </dl>
          </section>

          <section>
            <h3>属性</h3>
            <dl className="detail-list compact">
              {character.characteristics &&
                Object.entries(character.characteristics).map(([key, value]) => <Stat label={key.toUpperCase()} value={value} key={key} />)}
            </dl>
          </section>
        </div>

        <section className="detail-section">
          <h3>高技能</h3>
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
                {topSkills.map((skill) => (
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

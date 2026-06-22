import { useMemo, useState, type ChangeEvent } from 'react'
import type { Character, CharacterSheetExtras, SkillAllocation } from '../types'
import {
  allocationsToSkillMap,
  auditCharacterDraft,
  autoAllocateSkills,
  characteristicLabels,
  clampCharacteristic,
  createCharacter,
  defaultCharacteristics,
  deriveBuildAndDb,
  deriveHp,
  deriveMov,
  deriveMp,
  initialSkillAllocations,
  occupationLimit,
  occupationPoints,
  occupationTemplates,
  personalInterestPoints,
  randomCharacteristics,
  recalculateSkillAllocations,
  selectedOccupationSkillCount,
  usedInterestSkillPoints,
  usedOccupationSkillPoints,
  type Characteristics,
  type OccupationTemplate,
} from '../creator/characterCreation'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (character: Character) => void
}

type Backstory = NonNullable<Character['backstory']>
type CreatorTab = 'sheet' | 'backstory' | 'check'

const emptyBackstory: Backstory = {
  ideology: '',
  significantPeople: '',
  meaningfulLocations: '',
  treasuredPossessions: '',
  traits: '',
  darkSecret: '',
  injuriesScars: '',
  phobiasManias: '',
  personalDescription: '',
  investigatorExperiences: '',
  mythosEncounters: '',
  spells: '',
  allies: '',
}

const defaultExtras: CharacterSheetExtras = {
  era: '1920s',
  cash: '',
  assets: '',
  spendingLevel: '',
  equipment: '',
  weapons: '',
  armor: '',
  portraitNote: '',
}

function normalizeBackstory(value: Character['backstory'] | undefined): Backstory {
  return {
    ...emptyBackstory,
    ...(value ?? {}),
  }
}

function normalizeCharacteristics(value: Character['characteristics'] | undefined): Characteristics {
  return {
    ...defaultCharacteristics,
    ...(value ?? {}),
  }
}

function extractCharacterFromImport(value: unknown): Character | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<Character> & { character?: Character; characters?: Character[] }
  if (record.character && typeof record.character === 'object') return record.character
  if (Array.isArray(record.characters)) {
    return record.characters.find((character) => character?.type === 'investigator') ?? record.characters[0] ?? null
  }
  if (record.name && record.skills && typeof record.skills === 'object') return record as Character
  return null
}

function buildLocalBackstory(name: string, occupation: OccupationTemplate): Backstory {
  const displayName = name || '这名调查员'
  return {
    ideology: `${displayName}相信真相必须留下记录，即使记录本身会带来危险。`,
    significantPeople: `一位曾帮助其入行的${occupation.contacts.split('、')[0] ?? '旧识'}，如今突然失联。`,
    meaningfulLocations: '校园旧记录室，那里保存着一份与其过去有关的旧卷宗。',
    treasuredPossessions: '一本边角磨损的笔记本，夹着几张没有日期的收据。',
    traits: '谨慎、好奇，对不合逻辑的细节异常敏感。',
    darkSecret: '曾在一次采访中隐瞒了关键证词，此事至今仍能被人用来威胁。',
    injuriesScars: '左手有一道旧伤，来源不愿多谈。',
    phobiasManias: '对深夜里持续重复的敲击声感到不安。',
    personalDescription: `${displayName}是一名${occupation.name}，${occupation.description}`,
    investigatorExperiences: '尚未经历正式模组。',
    mythosEncounters: '尚无明确神话接触记录。',
    spells: '无。',
    allies: '一位可以提供普通消息的旧识。',
  }
}

function compareSkillPriority(a: SkillAllocation, b: SkillAllocation): number {
  const aAdded = a.occupationAdded + a.interestAdded
  const bAdded = b.occupationAdded + b.interestAdded
  if (aAdded !== bAdded) return bAdded - aAdded
  if (a.isOccupation !== b.isOccupation) return a.isOccupation ? -1 : 1
  if (a.forcedOccupation !== b.forcedOccupation) return a.forcedOccupation ? -1 : 1
  if (a.category !== b.category) return a.category.localeCompare(b.category, 'zh-CN')
  return a.label.localeCompare(b.label, 'zh-CN')
}

export function CharacterCreator({ open, onClose, onCreate }: Props) {
  const [tab, setTab] = useState<CreatorTab>('sheet')
  const [mode, setMode] = useState<'point-buy' | 'random'>('point-buy')
  const [pointPool, setPointPool] = useState(460)
  const [name, setName] = useState('新调查员')
  const [player, setPlayer] = useState('')
  const [age, setAge] = useState(28)
  const [sex, setSex] = useState('')
  const [residence, setResidence] = useState('雾港')
  const [birthplace, setBirthplace] = useState('')
  const [occupationId, setOccupationId] = useState(occupationTemplates[0].id)
  const [characteristics, setCharacteristics] = useState<Characteristics>(defaultCharacteristics)
  const [allocations, setAllocations] = useState<SkillAllocation[]>(() => autoAllocateSkills(occupationTemplates[0], defaultCharacteristics))
  const [backstory, setBackstory] = useState<Backstory>(emptyBackstory)
  const [extras, setExtras] = useState<CharacterSheetExtras>(() => ({ ...defaultExtras, creditRatingRange: occupationTemplates[0].creditRating }))
  const [aiStatus, setAiStatus] = useState('可用本地生成；DeepSeek API 运行时会优先请求模型。')
  const [archiveStatus, setArchiveStatus] = useState('可导入已保存的调查员 JSON，或保存当前新调查员。')

  const occupation = occupationTemplates.find((item) => item.id === occupationId) ?? occupationTemplates[0]

  const derived = useMemo(() => {
    const hp = deriveHp(characteristics)
    const mp = deriveMp(characteristics)
    const mov = deriveMov(characteristics, age)
    const db = deriveBuildAndDb(characteristics)
    const used = Object.values(characteristics).reduce((sum, value) => sum + value, 0)
    const occupationBudget = occupationPoints(occupation, characteristics)
    const interestBudget = personalInterestPoints(characteristics)
    const occupationUsed = usedOccupationSkillPoints(allocations)
    const interestUsed = usedInterestSkillPoints(allocations)
    return {
      hp,
      mp,
      mov,
      ...db,
      san: characteristics.pow,
      used,
      remaining: pointPool - used,
      occupationBudget,
      interestBudget,
      occupationUsed,
      interestUsed,
      occupationSelected: selectedOccupationSkillCount(allocations),
      occupationRequired: occupationLimit(occupation),
    }
  }, [age, allocations, characteristics, occupation, pointPool])

  const sortedAllocations = useMemo(() => [...allocations].sort(compareSkillPriority), [allocations])

  const audit = useMemo(
    () =>
      auditCharacterDraft({
        name,
        age,
        occupation,
        characteristics,
        allocations,
        backstory,
        extras,
        pointPool,
        mode,
      }),
    [age, allocations, backstory, characteristics, extras, mode, name, occupation, pointPool],
  )

  if (!open) return null

  function buildDraftCharacter(): Character | null {
    const currentAudit = auditCharacterDraft({
      name,
      age,
      occupation,
      characteristics,
      allocations,
      backstory,
      extras,
      pointPool,
      mode,
    })
    if (currentAudit.missing.length) {
      setTab('check')
      setArchiveStatus('当前调查员仍有必须补齐或超支项目，暂不能保存。')
      return null
    }
    return createCharacter({
      name,
      player,
      age,
      sex,
      residence,
      birthplace,
      occupation,
      characteristics,
      allocations,
      backstory,
      extras,
      audit: currentAudit,
    })
  }

  function saveDraftCharacter() {
    const character = buildDraftCharacter()
    if (!character) return
    const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${character.name || 'investigator'}.json`
    link.click()
    URL.revokeObjectURL(url)
    setArchiveStatus(`已保存调查员：${character.name}`)
  }

  function loadCharacterIntoEditor(character: Character) {
    const nextOccupation = occupationTemplates.find((item) => item.name === character.role) ?? occupationTemplates[0]
    const nextCharacteristics = normalizeCharacteristics(character.characteristics)
    const importedBreakdown = new Map((character.skillBreakdown ?? []).map((skill) => [skill.key, skill]))
    const importedSkills = character.skills ?? {}
    const importedAllocations = recalculateSkillAllocations(
      initialSkillAllocations(nextOccupation, nextCharacteristics).map((skill) => {
        const importedSkill = importedBreakdown.get(skill.key)
        if (importedSkill) {
          return {
            ...skill,
            occupationAdded: Math.max(0, Number(importedSkill.occupationAdded) || 0),
            interestAdded: Math.max(0, Number(importedSkill.interestAdded) || 0),
            isOccupation: skill.forcedOccupation ? true : Boolean(importedSkill.isOccupation),
          }
        }
        const importedFinal = importedSkills[skill.key]
        if (typeof importedFinal !== 'number') return skill
        const added = Math.max(0, importedFinal - skill.base)
        return {
          ...skill,
          occupationAdded: skill.isOccupation ? added : 0,
          interestAdded: skill.isOccupation ? 0 : added,
        }
      }),
      nextCharacteristics,
    )

    setMode('point-buy')
    setName(character.name || '未命名调查员')
    setPlayer(character.player ?? '')
    setAge(character.age ?? 28)
    setSex(character.sex ?? '')
    setResidence(character.residence ?? '')
    setBirthplace(character.birthplace ?? '')
    setOccupationId(nextOccupation.id)
    setCharacteristics(nextCharacteristics)
    setAllocations(importedAllocations)
    setBackstory(normalizeBackstory(character.backstory))
    setExtras({
      ...defaultExtras,
      ...(character.sheetExtras ?? {}),
      creditRatingRange: character.sheetExtras?.creditRatingRange ?? nextOccupation.creditRating,
    })
    setTab('sheet')
    setArchiveStatus(`已导入旧调查员：${character.name || '未命名调查员'}。可继续编辑，或创建加入当前团。`)
  }

  function handleCharacterImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setArchiveStatus(`正在导入：${file.name}`)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const imported = extractCharacterFromImport(JSON.parse(text))
        if (!imported) throw new Error('invalid character json')
        loadCharacterIntoEditor(imported)
      } catch {
        setArchiveStatus('导入失败：请选择单个调查员 JSON，或包含 characters 的团存档 JSON。')
      }
    }
    reader.onerror = () => setArchiveStatus('导入失败：文件读取失败，请重新选择 JSON。')
    reader.readAsText(file, 'utf-8')
    event.target.value = ''
  }

  function updateCharacteristic(key: keyof Characteristics, value: number) {
    const next = { ...characteristics, [key]: clampCharacteristic(value) }
    setCharacteristics(next)
    setAllocations((current) => recalculateSkillAllocations(current, next))
  }

  function reroll() {
    const next = randomCharacteristics()
    setMode('random')
    setCharacteristics(next)
    setAllocations(autoAllocateSkills(occupation, next))
  }

  function applyOccupation(nextOccupationId: string) {
    const nextOccupation = occupationTemplates.find((item) => item.id === nextOccupationId) ?? occupation
    setOccupationId(nextOccupation.id)
    setExtras((current) => ({ ...current, creditRatingRange: nextOccupation.creditRating }))
    setAllocations(autoAllocateSkills(nextOccupation, characteristics))
  }

  function updateSkill(key: string, patch: Partial<SkillAllocation>) {
    setAllocations((current) =>
      recalculateSkillAllocations(
        current.map((skill) => (skill.key === key ? { ...skill, ...patch } : skill)),
        characteristics,
      ),
    )
  }

  function toggleOccupationSkill(skill: SkillAllocation) {
    if (skill.forcedOccupation) return
    const nextValue = !skill.isOccupation
    const selected = selectedOccupationSkillCount(allocations)
    if (nextValue && selected >= occupationLimit(occupation)) return
    updateSkill(skill.key, {
      isOccupation: nextValue,
      occupationAdded: nextValue ? skill.occupationAdded : 0,
    })
  }

  function updateExtras(patch: Partial<CharacterSheetExtras>) {
    setExtras((current) => ({ ...current, ...patch }))
  }

  async function generateBackstory() {
    setAiStatus('正在生成背景...')
    try {
      const response = await fetch('http://127.0.0.1:8787/api/character-backstory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          age,
          sex,
          residence,
          birthplace,
          occupation,
          characteristics,
          skills: allocationsToSkillMap(allocations),
        }),
      })
      if (!response.ok) throw new Error(`API ${response.status}`)
      const data = (await response.json()) as { backstory: Backstory }
      setBackstory(data.backstory)
      setAiStatus('DeepSeek 已生成背景。')
    } catch {
      setBackstory(buildLocalBackstory(name, occupation))
      setAiStatus('DeepSeek 不可用，已用本地模板生成背景。')
    }
  }

  function submit() {
    const currentAudit = auditCharacterDraft({
      name,
      age,
      occupation,
      characteristics,
      allocations,
      backstory,
      extras,
      pointPool,
      mode,
    })
    if (currentAudit.missing.length) {
      setTab('check')
      return
    }
    onCreate(
      createCharacter({
        name,
        player,
        age,
        sex,
        residence,
        birthplace,
        occupation,
        characteristics,
        allocations,
        backstory,
        extras,
        audit: currentAudit,
      }),
    )
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="creator-modal creator-modal-wide" role="dialog" aria-modal="true" aria-labelledby="creator-title">
        <header className="modal-titlebar">
          <div>
            <p className="eyebrow">Investigator Builder</p>
            <h2 id="creator-title">创建调查员</h2>
          </div>
          <div className="creator-archive-actions">
            <label className="ghost-button creator-file-button">
              导入旧调查员
              <input type="file" accept=".json,application/json" onChange={handleCharacterImport} />
            </label>
            <button className="ghost-button" type="button" onClick={saveDraftCharacter}>
              保存新调查员
            </button>
            <button className="ghost-button" type="button" onClick={onClose}>
              关闭
            </button>
          </div>
        </header>

        <nav className="creator-tabs" aria-label="创建调查员步骤">
          {[
            ['sheet', '人物卡'],
            ['backstory', '背景'],
            ['check', '检查'],
          ].map(([key, label]) => (
            <button className={tab === key ? 'active' : ''} type="button" key={key} onClick={() => setTab(key as CreatorTab)}>
              {label}
            </button>
          ))}
        </nav>

        <p className="creator-archive-status">{archiveStatus}</p>

        <div className="creator-body">
          {tab === 'sheet' && (
            <section className="creator-workbench">
              <div className="creator-left-stack">
                <section className="creator-panel-block">
                  <h3>身份</h3>
                  <div className="creator-grid two">
                    <label>
                      姓名
                      <input value={name} onChange={(event) => setName(event.target.value)} />
                    </label>
                    <label>
                      玩家
                      <input value={player} onChange={(event) => setPlayer(event.target.value)} />
                    </label>
                    <label>
                      年龄
                      <input type="number" min={15} max={90} value={age} onChange={(event) => setAge(Number(event.target.value))} />
                    </label>
                    <label>
                      性别
                      <input value={sex} onChange={(event) => setSex(event.target.value)} />
                    </label>
                    <label>
                      时代
                      <input value={extras.era ?? ''} onChange={(event) => updateExtras({ era: event.target.value })} />
                    </label>
                    <label>
                      信用范围
                      <input value={extras.creditRatingRange ?? occupation.creditRating} onChange={(event) => updateExtras({ creditRatingRange: event.target.value })} />
                    </label>
                    <label>
                      住地
                      <input value={residence} onChange={(event) => setResidence(event.target.value)} />
                    </label>
                    <label>
                      故乡
                      <input value={birthplace} onChange={(event) => setBirthplace(event.target.value)} />
                    </label>
                  </div>

                  <label className="wide-label">
                    职业模板
                    <select value={occupation.id} onChange={(event) => applyOccupation(event.target.value)}>
                      {occupationTemplates.map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.name} · {item.pointFormula} · CR {item.creditRating}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="creator-note">{occupation.description}</p>
                </section>

                <section className="creator-panel-block">
                  <div className="creator-header-row">
                    <h3>属性</h3>
                    <div className="segmented compact" role="group" aria-label="创建方式">
                      <button className={mode === 'point-buy' ? 'active' : ''} type="button" onClick={() => setMode('point-buy')}>
                        购点
                      </button>
                      <button className={mode === 'random' ? 'active' : ''} type="button" onClick={reroll}>
                        随机
                      </button>
                    </div>
                  </div>

                  <label className="wide-label">
                    属性总点数
                    <input type="number" min={300} max={720} step={5} value={pointPool} onChange={(event) => setPointPool(Number(event.target.value))} />
                  </label>

                  <div className="creator-grid attrs attr-grid-compact">
                    {Object.entries(characteristicLabels).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          min={15}
                          max={90}
                          step={5}
                          value={characteristics[key as keyof Characteristics]}
                          onChange={(event) => updateCharacteristic(key as keyof Characteristics, Number(event.target.value))}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="derived-strip compact-strip">
                    <span>总点 {pointPool}</span>
                    <span className={derived.remaining < 0 ? 'danger' : ''}>已用 {derived.used}</span>
                    <span className={derived.remaining < 0 ? 'danger' : ''}>剩余 {derived.remaining}</span>
                    <span>HP {derived.hp}</span>
                    <span>SAN {derived.san}</span>
                    <span>MP {derived.mp}</span>
                    <span>MOV {derived.mov}</span>
                    <span>DB {derived.damageBonus}</span>
                    <span>体格 {derived.build}</span>
                  </div>
                </section>

                <section className="creator-panel-block">
                  <h3>资产与装备</h3>
                  <div className="creator-grid two">
                    <label>
                      现金
                      <input value={extras.cash ?? ''} onChange={(event) => updateExtras({ cash: event.target.value })} />
                    </label>
                    <label>
                      消费水平
                      <input value={extras.spendingLevel ?? ''} onChange={(event) => updateExtras({ spendingLevel: event.target.value })} />
                    </label>
                    <label>
                      资产
                      <input value={extras.assets ?? ''} onChange={(event) => updateExtras({ assets: event.target.value })} />
                    </label>
                    <label>
                      头像备注
                      <input value={extras.portraitNote ?? ''} onChange={(event) => updateExtras({ portraitNote: event.target.value })} />
                    </label>
                  </div>
                  <label className="wide-label">
                    携带装备
                    <textarea value={extras.equipment ?? ''} rows={3} onChange={(event) => updateExtras({ equipment: event.target.value })} />
                  </label>
                  <div className="creator-grid two">
                    <label>
                      武器
                      <textarea value={extras.weapons ?? ''} rows={3} onChange={(event) => updateExtras({ weapons: event.target.value })} />
                    </label>
                    <label>
                      护甲
                      <textarea value={extras.armor ?? ''} rows={3} onChange={(event) => updateExtras({ armor: event.target.value })} />
                    </label>
                  </div>
                </section>
              </div>

              <section className="creator-panel-block skill-panel-block">
                <div className="skill-ledger-header">
                  <div className="skill-ledger-title">
                    <span aria-hidden="true" />
                    <div>
                      <h3>技能填写</h3>
                      <p>调查员档案</p>
                    </div>
                  </div>
                  <div className="skill-ledger-metrics">
                    <div>
                      <span>职业技能</span>
                      <strong>{derived.occupationSelected}/{derived.occupationRequired}</strong>
                    </div>
                    <div className={derived.occupationUsed > derived.occupationBudget ? 'danger' : ''}>
                      <span>职业点</span>
                      <strong>{derived.occupationUsed}/{derived.occupationBudget}</strong>
                    </div>
                    <div className={derived.interestUsed > derived.interestBudget ? 'danger' : ''}>
                      <span>兴趣点</span>
                      <strong>{derived.interestUsed}/{derived.interestBudget}</strong>
                    </div>
                  </div>
                  <button className="skill-auto-button" type="button" onClick={() => setAllocations(autoAllocateSkills(occupation, characteristics))}>
                    自动分配
                  </button>
                </div>

                <div className="skill-card-grid">
                  {sortedAllocations.map((skill) => (
                    <article className={`skill-edit-card ${skill.occupationAdded + skill.interestAdded > 0 ? 'is-invested' : ''}`} key={skill.key}>
                      <div className="skill-card-head">
                        <label
                          className={`skill-check-label ${skill.forcedOccupation ? 'is-forced' : ''} ${
                            !skill.isOccupation && derived.occupationSelected >= derived.occupationRequired ? 'is-locked' : ''
                          }`}
                        >
                          <input
                            aria-label={`${skill.label}职业技能`}
                            type="checkbox"
                            checked={skill.isOccupation}
                            disabled={skill.forcedOccupation || (!skill.isOccupation && derived.occupationSelected >= derived.occupationRequired)}
                            onChange={() => toggleOccupationSkill(skill)}
                          />
                          <span aria-hidden="true" />
                        </label>
                        <div className="skill-name-block">
                          <h4>{skill.label}</h4>
                          <div className="skill-badges">
                            <span>{skill.category}</span>
                            <span className={skill.isOccupation ? 'is-career' : ''}>
                              {skill.forcedOccupation ? '强制' : skill.isOccupation ? '职业' : '非职'}
                            </span>
                          </div>
                        </div>
                        <div className="skill-total">
                          <span>总分</span>
                          <strong>{skill.final}</strong>
                        </div>
                      </div>
                      <div className="skill-point-grid">
                        <div>
                          <span>基础</span>
                          <strong>{skill.base}</strong>
                        </div>
                        <label>
                          <span>职业点</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={skill.occupationAdded}
                            disabled={!skill.isOccupation}
                            onChange={(event) => updateSkill(skill.key, { occupationAdded: Number(event.target.value) })}
                          />
                        </label>
                        <label>
                          <span>兴趣点</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={skill.interestAdded}
                            onChange={(event) => updateSkill(skill.key, { interestAdded: Number(event.target.value) })}
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          )}

          {tab === 'backstory' && (
            <section className="creator-section backstory-editor">
              <div className="creator-header-row">
                <div>
                  <h3>背景故事</h3>
                  <p className="creator-note">对应 Excel：形象描述、思想与信念、重要之人、意义非凡之地、宝贵之物、特质、难言之隐、伤口和疤痕、恐惧症和躁狂症、调查员经历、神话相关、法术一览、调查员伙伴。</p>
                </div>
                <button type="button" onClick={generateBackstory}>
                  AI/模板生成
                </button>
              </div>
              <div className="backstory-grid">
                <label>
                  形象描述
                  <textarea value={backstory.personalDescription} rows={4} onChange={(event) => setBackstory({ ...backstory, personalDescription: event.target.value })} />
                </label>
                <label>
                  思想与信念
                  <textarea value={backstory.ideology} rows={4} onChange={(event) => setBackstory({ ...backstory, ideology: event.target.value })} />
                </label>
                <label>
                  重要之人
                  <textarea value={backstory.significantPeople} rows={3} onChange={(event) => setBackstory({ ...backstory, significantPeople: event.target.value })} />
                </label>
                <label>
                  意义非凡之地
                  <textarea value={backstory.meaningfulLocations} rows={3} onChange={(event) => setBackstory({ ...backstory, meaningfulLocations: event.target.value })} />
                </label>
                <label>
                  宝贵之物
                  <textarea value={backstory.treasuredPossessions} rows={3} onChange={(event) => setBackstory({ ...backstory, treasuredPossessions: event.target.value })} />
                </label>
                <label>
                  特质
                  <textarea value={backstory.traits} rows={3} onChange={(event) => setBackstory({ ...backstory, traits: event.target.value })} />
                </label>
                <label>
                  难言之隐
                  <textarea value={backstory.darkSecret ?? ''} rows={3} onChange={(event) => setBackstory({ ...backstory, darkSecret: event.target.value })} />
                </label>
                <label>
                  伤口和疤痕
                  <textarea value={backstory.injuriesScars} rows={3} onChange={(event) => setBackstory({ ...backstory, injuriesScars: event.target.value })} />
                </label>
                <label>
                  恐惧症和躁狂症
                  <textarea value={backstory.phobiasManias} rows={3} onChange={(event) => setBackstory({ ...backstory, phobiasManias: event.target.value })} />
                </label>
                <label>
                  调查员经历
                  <textarea value={backstory.investigatorExperiences ?? ''} rows={3} onChange={(event) => setBackstory({ ...backstory, investigatorExperiences: event.target.value })} />
                </label>
                <label>
                  神话相关
                  <textarea value={backstory.mythosEncounters ?? ''} rows={3} onChange={(event) => setBackstory({ ...backstory, mythosEncounters: event.target.value })} />
                </label>
                <label>
                  法术一览
                  <textarea value={backstory.spells ?? ''} rows={3} onChange={(event) => setBackstory({ ...backstory, spells: event.target.value })} />
                </label>
                <label>
                  调查员伙伴
                  <textarea value={backstory.allies ?? ''} rows={3} onChange={(event) => setBackstory({ ...backstory, allies: event.target.value })} />
                </label>
              </div>
              <p className="creator-note">{aiStatus}</p>
            </section>
          )}

          {tab === 'check' && (
            <section className="creator-section">
              <div className="audit-grid">
                <div>
                  <h3>必须补齐</h3>
                  {audit.missing.length ? (
                    <ul>
                      {audit.missing.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="creator-note">核心项目已齐，可以创建。</p>
                  )}
                </div>
                <div>
                  <h3>Excel 对照提示</h3>
                  <ul>
                    {audit.warnings.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="creator-note">校验来源：{audit.source}</p>
            </section>
          )}
        </div>

        <footer className="modal-actions">
          <button className="ghost-button" type="button" onClick={() => setTab('check')}>
            检查遗漏项
          </button>
          <button className="primary-button" type="button" onClick={submit}>
            创建并加入当前团
          </button>
        </footer>
      </section>
    </div>
  )
}

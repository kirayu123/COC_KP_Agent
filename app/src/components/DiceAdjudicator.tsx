import { useMemo, useState } from 'react'
import { defaultCharacteristics, skillTemplates, type CharacteristicKey } from '../creator/characterCreation'
import { rollPercentile } from '../rules/coc7'
import type { CampaignState, Character, RollResult, SkillKey } from '../types'

type Difficulty = RollResult['difficulty']
type CheckMode = 'single' | 'cooperative' | 'opposed'
type CooperationMode = 'any' | 'all' | 'group_luck'
type ResourceType = 'none' | 'hp' | 'san' | 'mp' | 'luck' | 'custom'
type CostScope = 'actor' | 'opponent' | 'winner' | 'loser'
type ResultOutcome = 'success' | 'failure' | 'stalemate'

type RollLine = {
  characterId: string
  name: string
  itemLabel: string
  result: RollResult
  passed: boolean
}

type CostRoll = {
  resource: ResourceType
  formula: string
  total: number
  detail: string
  characterIds: string[]
  previews: Array<{
    characterId: string
    name: string
    before: number
    after: number
  }>
}

type AdjudicationResult = {
  mode: CheckMode
  title: string
  pushed: boolean
  difficulty: Difficulty
  outcome: ResultOutcome
  cooperationMode?: CooperationMode
  lines: RollLine[]
  opposedWinner?: string
  summary: string
  badgeLabel?: string
  ruleNote?: string
  cost?: CostRoll
  createdAt: string
}

type Props = {
  campaign: CampaignState
  onApplyResourceCost: (characterIds: string[], resource: Exclude<ResourceType, 'none' | 'custom'>, amount: number) => void
}

const difficultyLabels: Record<Difficulty, string> = {
  regular: '普通',
  hard: '困难',
  extreme: '极难',
}

const difficultyRank: Record<Difficulty, number> = {
  regular: 2,
  hard: 3,
  extreme: 4,
}

const successLabels: Record<RollResult['successLevel'], string> = {
  critical: '大成功',
  extreme: '极难成功',
  hard: '困难成功',
  regular: '普通成功',
  failure: '失败',
  fumble: '大失败',
}

const resourceLabels: Record<ResourceType, string> = {
  none: '无',
  hp: 'HP',
  san: 'SAN',
  mp: 'MP',
  luck: '幸运',
  custom: '自定义',
}

const cooperationLabels: Record<CooperationMode, string> = {
  any: '任一成功',
  all: '全员成功',
  group_luck: '团体幸运',
}

const costScopeLabels: Record<CostScope, string> = {
  actor: '甲方',
  opponent: '乙方',
  winner: '胜者',
  loser: '败者',
}

const characteristicOptions: Array<{ key: CharacteristicKey; label: string }> = [
  { key: 'str', label: '力量 STR' },
  { key: 'con', label: '体质 CON' },
  { key: 'siz', label: '体型 SIZ' },
  { key: 'dex', label: '敏捷 DEX' },
  { key: 'app', label: '外貌 APP' },
  { key: 'int', label: '智力 INT' },
  { key: 'pow', label: '意志 POW' },
  { key: 'edu', label: '教育 EDU' },
]

const fixedOptions = [
  { key: 'luck', label: '幸运 Luck' },
  { key: 'sanity', label: '理智 SAN' },
]

function successPassesDifficulty(result: RollResult, difficulty: Difficulty): boolean {
  return result.successRank >= difficultyRank[difficulty]
}

function lookupCharacterValue(character: Character | undefined, rawInput: string): { key: SkillKey; label: string; value: number } {
  const input = rawInput.trim()
  if (!character) return { key: input || 'custom', label: input || '手动判定', value: 1 }

  const characteristic = characteristicOptions.find(
    (item) => item.key === input.toLowerCase() || item.label.toLowerCase() === input.toLowerCase(),
  )
  if (characteristic) {
    return {
      key: characteristic.key,
      label: characteristic.label,
      value: character.characteristics?.[characteristic.key] ?? defaultCharacteristics[characteristic.key],
    }
  }

  const fixed = fixedOptions.find((item) => item.key === input.toLowerCase() || item.label.toLowerCase() === input.toLowerCase())
  if (fixed?.key === 'luck') return { key: 'luck', label: fixed.label, value: character.luck }
  if (fixed?.key === 'sanity') return { key: 'sanity', label: fixed.label, value: character.san }

  const skill =
    skillTemplates.find(
      (item) =>
        item.key === input ||
        item.key.toLowerCase() === input.toLowerCase() ||
        item.label === input ||
        item.label.toLowerCase() === input.toLowerCase(),
    ) ??
    skillTemplates.find((item) => item.label.includes(input) || item.key.includes(input.toLowerCase()))

  const key = skill?.key ?? input
  return {
    key,
    label: skill?.label ?? (input || '手动判定'),
    value: character.skills[key] ?? 1,
  }
}

function rollFormula(rawFormula: string): { total: number; detail: string } {
  const formula = rawFormula.trim()
  if (!formula || formula === '0') return { total: 0, detail: '0' }

  const normalized = formula.replace(/\s+/g, '').replace(/-/g, '+-')
  const terms = normalized.split('+').filter(Boolean)
  let total = 0
  const detailParts: string[] = []

  for (const term of terms) {
    const diceMatch = term.match(/^(-?)(\d*)d(\d+)$/i)
    if (diceMatch) {
      const sign = diceMatch[1] === '-' ? -1 : 1
      const count = Number(diceMatch[2] || 1)
      const sides = Number(diceMatch[3])
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
      const subtotal = rolls.reduce((sum, value) => sum + value, 0) * sign
      total += subtotal
      detailParts.push(`${term}(${rolls.join(',')})`)
      continue
    }

    const flat = Number(term)
    if (Number.isFinite(flat)) {
      total += flat
      detailParts.push(term)
    }
  }

  return { total: Math.max(0, total), detail: detailParts.join(' + ') || '0' }
}

function clampTarget(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(99, Math.round(value)))
}

function compareOpposedRolls(a: RollResult, aTarget: number, b: RollResult, bTarget: number): 'a' | 'b' | 'stalemate' | 'both_fail' {
  const aSucceeded = a.successRank >= difficultyRank.regular
  const bSucceeded = b.successRank >= difficultyRank.regular
  if (!aSucceeded && !bSucceeded) return 'both_fail'
  if (a.successRank > b.successRank) return 'a'
  if (b.successRank > a.successRank) return 'b'
  if (aTarget > bTarget) return 'a'
  if (bTarget > aTarget) return 'b'
  return 'stalemate'
}

function resolveCost(
  passed: boolean,
  successResource: ResourceType,
  successFormula: string,
  failureResource: ResourceType,
  failureFormula: string,
  characters: Character[],
): CostRoll | undefined {
  const resource = passed ? successResource : failureResource
  const formula = passed ? successFormula : failureFormula
  if (resource === 'none' || !formula.trim()) return undefined
  if (resource !== 'custom' && !characters.length) return undefined
  const rolled = rollFormula(formula)
  const previews =
    resource === 'custom'
      ? []
      : characters.map((character) => {
          const before = resource === 'hp' ? character.hp : resource === 'san' ? character.san : resource === 'mp' ? character.mp : character.luck
          return {
            characterId: character.id,
            name: character.name,
            before,
            after: Math.max(0, before - rolled.total),
          }
        })
  return {
    resource,
    formula,
    total: rolled.total,
    detail: rolled.detail,
    characterIds: characters.map((character) => character.id),
    previews,
  }
}

export function DiceAdjudicator({ campaign, onApplyResourceCost }: Props) {
  const investigators = useMemo(() => campaign.characters.filter((character) => character.type === 'investigator'), [campaign.characters])
  const rollActors = investigators.length ? investigators : campaign.characters
  const firstActorId = rollActors[0]?.id ?? ''

  const [mode, setMode] = useState<CheckMode>('single')
  const [actorId, setActorId] = useState(firstActorId)
  const [cooperativeIds, setCooperativeIds] = useState<string[]>(firstActorId ? [firstActorId] : [])
  const [opponentId, setOpponentId] = useState(campaign.characters.find((character) => character.type !== 'investigator')?.id ?? firstActorId)
  const [opponentName, setOpponentName] = useState('NPC')
  const [checkInput, setCheckInput] = useState('侦查')
  const [opponentCheckInput, setOpponentCheckInput] = useState('侦查')
  const [manualTarget, setManualTarget] = useState('')
  const [opponentManualTarget, setOpponentManualTarget] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('regular')
  const [bonusPenalty, setBonusPenalty] = useState(0)
  const [opponentBonusPenalty, setOpponentBonusPenalty] = useState(0)
  const [pushed, setPushed] = useState(false)
  const [cooperationMode, setCooperationMode] = useState<CooperationMode>('any')
  const [successResource, setSuccessResource] = useState<ResourceType>('none')
  const [successFormula, setSuccessFormula] = useState('0')
  const [failureResource, setFailureResource] = useState<ResourceType>('san')
  const [failureFormula, setFailureFormula] = useState('1d4')
  const [opposedCostScope, setOpposedCostScope] = useState<CostScope>('loser')
  const [result, setResult] = useState<AdjudicationResult | null>(null)
  const [appliedCostId, setAppliedCostId] = useState<string | null>(null)

  const actor = campaign.characters.find((character) => character.id === actorId) ?? rollActors[0]
  const opponent = campaign.characters.find((character) => character.id === opponentId)
  const currentLookup = lookupCharacterValue(actor, checkInput)
  const target = clampTarget(manualTarget === '' ? currentLookup.value : Number(manualTarget))
  const opponentLookup = lookupCharacterValue(opponent, opponentCheckInput)
  const opponentTarget = clampTarget(opponentManualTarget === '' ? opponentLookup.value : Number(opponentManualTarget))
  const optionLabels = useMemo(
    () => [
      ...characteristicOptions.map((item) => item.label),
      ...fixedOptions.map((item) => item.label),
      ...skillTemplates.map((item) => item.label),
      ...skillTemplates.map((item) => item.key),
    ],
    [],
  )

  function runSingleCheck() {
    if (!actor) return
    const roll = rollPercentile({
      characterId: actor.id,
      skill: currentLookup.key,
      target,
      difficulty,
      bonusPenalty,
    })
    const passed = successPassesDifficulty(roll, difficulty)
    const cost = resolveCost(passed, successResource, successFormula, failureResource, failureFormula, [actor])
    setResult({
      mode,
      title: `${actor.name} / ${currentLookup.label}`,
      pushed,
      difficulty,
      outcome: passed ? 'success' : 'failure',
        lines: [{ characterId: actor.id, name: actor.name, itemLabel: currentLookup.label, result: roll, passed }],
        summary: `${difficultyLabels[difficulty]}判定 · ${passed ? '达成' : '未达成'}`,
        badgeLabel: passed ? '成功' : '失败',
        cost,
        createdAt: crypto.randomUUID(),
    })
    setAppliedCostId(null)
  }

  function runCooperativeCheck() {
    const selected = cooperativeIds
      .map((id) => campaign.characters.find((character) => character.id === id))
      .filter((character): character is Character => Boolean(character))
    if (!selected.length) return

    if (cooperationMode === 'group_luck') {
      const luckActor = [...selected].sort((a, b) => a.luck - b.luck)[0]
      const roll = rollPercentile({
        characterId: luckActor.id,
        skill: 'luck',
        target: clampTarget(luckActor.luck),
        difficulty: 'regular',
        bonusPenalty,
      })
      const passed = successPassesDifficulty(roll, 'regular')
      const cost = resolveCost(passed, successResource, successFormula, failureResource, failureFormula, [luckActor])
      setResult({
        mode,
        title: `团体幸运 / ${luckActor.name}`,
        pushed: false,
        difficulty: 'regular',
        outcome: passed ? 'success' : 'failure',
        cooperationMode,
        lines: [{ characterId: luckActor.id, name: luckActor.name, itemLabel: '最低幸运', result: roll, passed }],
        summary: `按规则由当前参与者中幸运最低者掷骰 · ${passed ? '达成' : '未达成'}`,
        badgeLabel: passed ? '成功' : '失败',
        ruleNote: '团体幸运检定使用出场调查员中幸运值最低者；幸运检定不能孤注一掷。',
        cost,
        createdAt: crypto.randomUUID(),
      })
      setAppliedCostId(null)
      return
    }

    const lines = selected.map((character) => {
      const lookup = lookupCharacterValue(character, checkInput)
      const roll = rollPercentile({
        characterId: character.id,
        skill: lookup.key,
        target: clampTarget(manualTarget === '' ? lookup.value : Number(manualTarget)),
        difficulty,
        bonusPenalty,
      })
      return {
        characterId: character.id,
        name: character.name,
        itemLabel: lookup.label,
        result: roll,
        passed: successPassesDifficulty(roll, difficulty),
      }
    })
    const passed = cooperationMode === 'any' ? lines.some((line) => line.passed) : lines.every((line) => line.passed)
    const costTargets = selected.filter((character) => {
      const line = lines.find((item) => item.characterId === character.id)
      return passed ? line?.passed : !line?.passed
    })
    const cost = resolveCost(passed, successResource, successFormula, failureResource, failureFormula, costTargets)
    setResult({
      mode,
      title: `合作 / ${checkInput || '手动判定'}`,
      pushed,
      difficulty,
      outcome: passed ? 'success' : 'failure',
      cooperationMode,
      lines,
      summary: `${cooperationLabels[cooperationMode]} · ${difficultyLabels[difficulty]}判定 · ${passed ? '达成' : '未达成'}`,
      badgeLabel: passed ? '成功' : '失败',
      ruleNote: '合作检定由 KP 选择判定口径；规则书的组合技能检定也采用“任一成功或全部成功”的裁定口径。',
      cost,
      createdAt: crypto.randomUUID(),
    })
    setAppliedCostId(null)
  }

  function runOpposedCheck() {
    if (!actor) return
    const sideARoll = rollPercentile({
      characterId: actor.id,
      skill: currentLookup.key,
      target,
      difficulty: 'regular',
      bonusPenalty,
    })
    const sideBRoll = rollPercentile({
      characterId: opponent?.id ?? 'custom-opponent',
      skill: opponentLookup.key,
      target: opponentTarget,
      difficulty: 'regular',
      bonusPenalty: opponentBonusPenalty,
    })
    const sideAName = actor.name
    const sideBName = opponent?.name ?? (opponentName.trim() || 'NPC')
    const outcome = compareOpposedRolls(sideARoll, target, sideBRoll, opponentTarget)
    const sideAId = actor.id
    const sideBId = opponent?.id ?? 'custom-opponent'
    const sideBCharacter = opponent ?? undefined
    const winnerCharacters = outcome === 'a' ? [actor] : outcome === 'b' && sideBCharacter ? [sideBCharacter] : []
    const loserCharacters = outcome === 'a' && sideBCharacter ? [sideBCharacter] : outcome === 'b' ? [actor] : []
    const costCharacters =
      opposedCostScope === 'actor'
        ? [actor]
        : opposedCostScope === 'opponent'
          ? sideBCharacter
            ? [sideBCharacter]
            : []
          : opposedCostScope === 'winner'
            ? winnerCharacters
            : loserCharacters
    const actorWins = outcome === 'a'
    const cost = resolveCost(actorWins, successResource, successFormula, failureResource, failureFormula, costCharacters)
    const summary =
      outcome === 'a'
        ? `胜出：${sideAName}`
        : outcome === 'b'
          ? `胜出：${sideBName}`
          : outcome === 'both_fail'
            ? '双方都失败：无事发生'
            : '平手：僵局或双方重骰'
    setResult({
      mode,
      title: `${sideAName} vs ${sideBName}`,
      pushed: false,
      difficulty: 'regular',
      outcome: outcome === 'a' ? 'success' : outcome === 'b' ? 'failure' : 'stalemate',
      lines: [
        { characterId: sideAId, name: sideAName, itemLabel: currentLookup.label, result: sideARoll, passed: sideARoll.successRank >= 2 },
        {
          characterId: sideBId,
          name: sideBName,
          itemLabel: opponentLookup.label,
          result: sideBRoll,
          passed: sideBRoll.successRank >= 2,
        },
      ],
      opposedWinner:
        outcome === 'a' ? sideAName : outcome === 'b' ? sideBName : outcome === 'both_fail' ? '双方失败，无事发生' : '僵局，交由 KP 裁定或重骰',
      summary,
      badgeLabel: outcome === 'a' || outcome === 'b' ? '胜出' : outcome === 'both_fail' ? '无胜者' : '僵局',
      ruleNote: '对抗检定比较成功等级；平手时目标值较高者胜；仍平手则僵局或重骰。对抗检定不能孤注一掷。',
      cost,
      createdAt: crypto.randomUUID(),
    })
    setAppliedCostId(null)
  }

  function runAdjudication() {
    if (mode === 'single') runSingleCheck()
    if (mode === 'cooperative') runCooperativeCheck()
    if (mode === 'opposed') runOpposedCheck()
  }

  function toggleCooperativeCharacter(id: string) {
    setCooperativeIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const resultPassed =
    result?.outcome === 'success'
  const canApplyCost =
    result?.cost &&
    result.cost.total > 0 &&
    result.cost.resource !== 'none' &&
    result.cost.resource !== 'custom' &&
    result.cost.characterIds.length > 0 &&
    appliedCostId !== result.createdAt

  return (
    <section className="dice-panel" aria-label="掷骰裁定">
      <header className="dice-panel-head">
        <div>
          <p className="eyebrow">Keeper Ruling</p>
          <h2>掷骰裁定</h2>
        </div>
        <span>{mode === 'single' ? '单人' : mode === 'cooperative' ? '合作' : '对抗'}</span>
      </header>

      <div className="dice-mode-tabs" role="tablist" aria-label="判定类型">
        {[
          ['single', '单人'],
          ['cooperative', '合作'],
          ['opposed', '对抗'],
        ].map(([value, label]) => (
          <button className={mode === value ? 'active' : ''} type="button" key={value} onClick={() => setMode(value as CheckMode)}>
            {label}
          </button>
        ))}
      </div>

      <div className="dice-form-grid">
        {mode !== 'cooperative' ? (
          <label>
            调查员
            <select value={actor?.id ?? ''} onChange={(event) => setActorId(event.target.value)}>
              {rollActors.map((character) => (
                <option value={character.id} key={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <fieldset className="dice-checkset">
            <legend>参与者</legend>
            <div className="dice-chip-grid">
              {rollActors.map((character) => (
                <label className="dice-check-chip" key={character.id}>
                  <input
                    type="checkbox"
                    checked={cooperativeIds.includes(character.id)}
                    onChange={() => toggleCooperativeCharacter(character.id)}
                  />
                  <span>{character.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label>
          判定项
          <input list="dice-check-options" value={checkInput} onChange={(event) => setCheckInput(event.target.value)} />
        </label>
        <datalist id="dice-check-options">
          {optionLabels.map((label) => (
            <option value={label} key={label} />
          ))}
        </datalist>

        <label>
          目标值
          <input
            type="number"
            min={1}
            max={99}
            placeholder={`${target}`}
            value={manualTarget}
            onChange={(event) => setManualTarget(event.target.value)}
          />
        </label>

        {mode === 'cooperative' && (
          <label>
            合作条件
            <select value={cooperationMode} onChange={(event) => setCooperationMode(event.target.value as CooperationMode)}>
              <option value="any">任一成功</option>
              <option value="all">全员成功</option>
              <option value="group_luck">团体幸运</option>
            </select>
          </label>
        )}

        {mode === 'opposed' && (
          <>
            <label>
              对手
              <select value={opponent?.id ?? 'custom'} onChange={(event) => setOpponentId(event.target.value)}>
                <option value="custom">手动 NPC</option>
                {campaign.characters.map((character) => (
                  <option value={character.id} key={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </label>
            {!opponent && (
              <label>
                对手名称
                <input value={opponentName} onChange={(event) => setOpponentName(event.target.value)} />
              </label>
            )}
            <label>
              对手判定项
              <input list="dice-check-options" value={opponentCheckInput} onChange={(event) => setOpponentCheckInput(event.target.value)} />
            </label>
            <label>
              对手目标值
              <input
                type="number"
                min={1}
                max={99}
                placeholder={`${opponentTarget}`}
                value={opponentManualTarget}
                onChange={(event) => setOpponentManualTarget(event.target.value)}
              />
            </label>
          </>
        )}
      </div>

      {mode !== 'opposed' && (
        <div className="dice-segment-row">
          <span>难度</span>
          {(['regular', 'hard', 'extreme'] as Difficulty[]).map((item) => (
            <button className={difficulty === item ? 'active' : ''} type="button" onClick={() => setDifficulty(item)} key={item}>
              {difficultyLabels[item]}
            </button>
          ))}
        </div>
      )}

      <div className="dice-segment-row">
        <span>{mode === 'opposed' ? '甲方修正' : '奖励/惩罚'}</span>
        {[-2, -1, 0, 1, 2].map((item) => (
          <button className={bonusPenalty === item ? 'active' : ''} type="button" onClick={() => setBonusPenalty(item)} key={item}>
            {item > 0 ? `+${item}` : item}
          </button>
        ))}
      </div>

      {mode === 'opposed' && (
        <div className="dice-segment-row">
          <span>乙方修正</span>
          {[-2, -1, 0, 1, 2].map((item) => (
            <button
              className={opponentBonusPenalty === item ? 'active' : ''}
              type="button"
              onClick={() => setOpponentBonusPenalty(item)}
              key={item}
            >
              {item > 0 ? `+${item}` : item}
            </button>
          ))}
        </div>
      )}

      {mode === 'opposed' || (mode === 'cooperative' && cooperationMode === 'group_luck') ? (
        <p className="dice-rule-note">{mode === 'opposed' ? '对抗检定不能孤注一掷。' : '团体幸运属于幸运检定，不能孤注一掷。'}</p>
      ) : (
        <label className="dice-push-check">
          <input type="checkbox" checked={pushed} onChange={(event) => setPushed(event.target.checked)} />
          <span>孤注一掷</span>
        </label>
      )}

      <div className="dice-cost-box">
          <h3>结果代价</h3>
          {mode === 'opposed' && (
            <label className="wide-label">
              对抗代价对象
              <select value={opposedCostScope} onChange={(event) => setOpposedCostScope(event.target.value as CostScope)}>
                {Object.entries(costScopeLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="dice-cost-grid">
            <label>
              成功扣除
              <select value={successResource} onChange={(event) => setSuccessResource(event.target.value as ResourceType)}>
                {Object.entries(resourceLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              公式
              <input value={successFormula} onChange={(event) => setSuccessFormula(event.target.value)} placeholder="0" />
            </label>
            <label>
              失败扣除
              <select value={failureResource} onChange={(event) => setFailureResource(event.target.value as ResourceType)}>
                {Object.entries(resourceLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              公式
              <input value={failureFormula} onChange={(event) => setFailureFormula(event.target.value)} placeholder="1d4" />
            </label>
          </div>
          <div className="dice-templates" aria-label="常用扣除模板">
            {[
              ['SAN 0/1', 'san', '0', 'san', '1'],
              ['SAN 0/1d4', 'none', '0', 'san', '1d4'],
              ['SAN 1/1d6', 'san', '1', 'san', '1d6'],
              ['HP 1d3', 'none', '0', 'hp', '1d3'],
            ].map(([label, sResource, sFormula, fResource, fFormula]) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  setSuccessResource(sResource as ResourceType)
                  setSuccessFormula(sFormula)
                  setFailureResource(fResource as ResourceType)
                  setFailureFormula(fFormula)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      <button className="primary-button dice-roll-button" type="button" onClick={runAdjudication} disabled={!rollActors.length}>
        掷骰
      </button>

      {result && (
        <article className={`dice-result-card ${result.outcome === 'stalemate' ? 'is-neutral' : resultPassed ? 'is-pass' : 'is-fail'}`}>
          <div className="dice-result-title">
            <div>
              <h3>{result.title}</h3>
              <p>
                {result.summary}
                {result.pushed ? ' · 孤注一掷' : ''}
              </p>
            </div>
            <strong>{result.badgeLabel ?? (result.outcome === 'stalemate' ? '僵局' : resultPassed ? '成功' : '失败')}</strong>
          </div>

          <div className="dice-roll-lines">
            {result.lines.map((line) => (
              <div className="dice-roll-line" key={`${result.createdAt}-${line.characterId}`}>
                <span>{line.name}</span>
                <span>{line.itemLabel}</span>
                <strong>{line.result.roll}</strong>
                <em>
                  {successLabels[line.result.successLevel]} / {line.result.target}
                </em>
              </div>
            ))}
          </div>

          {result.ruleNote && <p className="dice-rule-note">{result.ruleNote}</p>}

          {result.cost && (
            <div className="dice-cost-result">
              <span>{resourceLabels[result.cost.resource]}</span>
              <strong>
                {result.cost.formula} = {result.cost.total}
              </strong>
              <small>{result.cost.detail}</small>
              {result.cost.previews.map((preview) => (
                <small key={preview.characterId}>
                  {preview.name} {preview.before} {'->'} {preview.after}
                </small>
              ))}
              {canApplyCost && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyResourceCost(
                      result.cost!.characterIds,
                      result.cost!.resource as Exclude<ResourceType, 'none' | 'custom'>,
                      result.cost!.total,
                    )
                    setAppliedCostId(result.createdAt)
                  }}
                >
                  应用扣除
                </button>
              )}
              {appliedCostId === result.createdAt && <small>已应用到人物卡</small>}
            </div>
          )}
        </article>
      )}
    </section>
  )
}

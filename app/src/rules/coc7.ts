import type { RollResult, SkillKey } from '../types'

const successRank: Record<RollResult['successLevel'], number> = {
  fumble: 0,
  failure: 1,
  regular: 2,
  hard: 3,
  extreme: 4,
  critical: 5,
}

function d10(): number {
  return Math.floor(Math.random() * 10)
}

function d100Ones(): number {
  return Math.floor(Math.random() * 10)
}

function combine(tens: number, ones: number): number {
  const value = tens * 10 + ones
  return value === 0 ? 100 : value
}

export function labelForSkill(skill: SkillKey): string {
  const labels: Record<string, string> = {
    accounting: '会计',
    anthropology: '人类学',
    appraise: '估价',
    archaeology: '考古学',
    art_craft: '艺术/手艺',
    animal_handling: '动物驯养',
    charm: '取悦',
    climb: '攀爬',
    credit_rating: '信用评级',
    cthulhu_mythos: '克苏鲁神话',
    disguise: '乔装',
    spot_hidden: '侦查',
    locksmith: '锁匠',
    library_use: '图书馆使用',
    listen: '聆听',
    psychology: '心理学',
    fast_talk: '话术',
    dodge: '闪避',
    drive_auto: '汽车驾驶',
    electrical_repair: '电气维修',
    fighting_brawl: '格斗(斗殴)',
    firearms_handgun: '射击(手枪)',
    firearms_rifle_shotgun: '射击(步枪/霰弹枪)',
    first_aid: '急救',
    history: '历史',
    intimidate: '恐吓',
    jump: '跳跃',
    language_own: '母语',
    language_other: '外语',
    law: '法律',
    mechanical_repair: '机械维修',
    medicine: '医学',
    natural_world: '博物学',
    navigate: '导航',
    occult: '神秘学',
    persuade: '说服',
    photography: '摄影',
    psychoanalysis: '精神分析',
    ride: '骑术',
    science: '科学',
    sleight_of_hand: '妙手',
    stealth: '潜行',
    swim: '游泳',
    throw: '投掷',
    track: '追踪',
    sanity: '理智',
    strength: '力量',
  }
  return labels[skill] ?? skill
}

export function evaluateSuccess(roll: number, target: number): RollResult['successLevel'] {
  if (roll === 1) return 'critical'
  if (roll === 100 || (target < 50 && roll >= 96)) return 'fumble'
  if (roll <= Math.floor(target / 5)) return 'extreme'
  if (roll <= Math.floor(target / 2)) return 'hard'
  if (roll <= target) return 'regular'
  return 'failure'
}

export function rollPercentile(params: {
  characterId: string
  skill: SkillKey
  target: number
  difficulty: RollResult['difficulty']
  bonusPenalty?: number
}): RollResult {
  const bonusPenalty = Math.max(-2, Math.min(2, params.bonusPenalty ?? 0))
  const ones = d100Ones()
  const tensCandidates = Array.from({ length: Math.abs(bonusPenalty) + 1 }, d10)
  const selectedTens =
    bonusPenalty > 0 ? Math.min(...tensCandidates) : bonusPenalty < 0 ? Math.max(...tensCandidates) : tensCandidates[0]
  const roll = combine(selectedTens, ones)
  const successLevel = evaluateSuccess(roll, params.target)

  return {
    id: crypto.randomUUID(),
    characterId: params.characterId,
    skill: params.skill,
    target: params.target,
    difficulty: params.difficulty,
    bonusPenalty,
    ones,
    tensCandidates,
    selectedTens,
    roll,
    successLevel,
    successRank: successRank[successLevel],
    luckToRegular: roll > params.target ? roll - params.target : undefined,
    luckToHard: roll > Math.floor(params.target / 2) ? roll - Math.floor(params.target / 2) : undefined,
    luckToExtreme: roll > Math.floor(params.target / 5) ? roll - Math.floor(params.target / 5) : undefined,
    createdAt: new Date().toISOString(),
  }
}

export function formatRoll(result: RollResult): string {
  const levelLabels: Record<RollResult['successLevel'], string> = {
    critical: '大成功',
    extreme: '极难成功',
    hard: '困难成功',
    regular: '成功',
    failure: '失败',
    fumble: '大失败',
  }
  const modifier =
    result.bonusPenalty > 0 ? `奖励骰 +${result.bonusPenalty}` : result.bonusPenalty < 0 ? `惩罚骰 ${result.bonusPenalty}` : '无奖励/惩罚'
  return `${labelForSkill(result.skill)} ${result.target}%：掷出 ${result.roll}，${levelLabels[result.successLevel]}（${modifier}；十位候选 ${result.tensCandidates
    .map((n) => n * 10)
    .join('/')}，个位 ${result.ones}）`
}

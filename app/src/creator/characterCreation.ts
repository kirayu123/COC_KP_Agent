import type { Character, CharacterSheetExtras, CreationAudit, SkillAllocation, SkillKey } from '../types'

export type CharacteristicKey = 'str' | 'con' | 'siz' | 'dex' | 'app' | 'int' | 'pow' | 'edu'

export type Characteristics = Record<CharacteristicKey, number>

export type SkillTemplate = {
  key: SkillKey
  label: string
  base: number | 'DEX/2' | 'EDU' | 'POW' | 'STR'
  category: string
}

export type OccupationTemplate = {
  id: string
  name: string
  creditRating: string
  pointFormula: string
  forcedSkills: SkillKey[]
  recommendedSkills: SkillKey[]
  occupationSkillChoices: number
  contacts: string
  description: string
}

export const characteristicLabels: Record<CharacteristicKey, string> = {
  str: '力量 STR',
  con: '体质 CON',
  siz: '体型 SIZ',
  dex: '敏捷 DEX',
  app: '外貌 APP',
  int: '智力 INT',
  pow: '意志 POW',
  edu: '教育 EDU',
}

export const defaultCharacteristics: Characteristics = {
  str: 50,
  con: 50,
  siz: 60,
  dex: 50,
  app: 50,
  int: 60,
  pow: 50,
  edu: 60,
}

export const skillTemplates: SkillTemplate[] = [
  { key: 'accounting', label: '会计', base: 5, category: '知识' },
  { key: 'anthropology', label: '人类学', base: 1, category: '知识' },
  { key: 'appraise', label: '估价', base: 5, category: '知识' },
  { key: 'archaeology', label: '考古学', base: 1, category: '知识' },
  { key: 'art_craft', label: '艺术/手艺', base: 5, category: '专业' },
  { key: 'animal_handling', label: '动物驯养', base: 5, category: '专业' },
  { key: 'charm', label: '取悦', base: 15, category: '社交' },
  { key: 'climb', label: '攀爬', base: 20, category: '行动' },
  { key: 'credit_rating', label: '信用评级', base: 0, category: '身份' },
  { key: 'cthulhu_mythos', label: '克苏鲁神话', base: 0, category: '神话' },
  { key: 'disguise', label: '乔装', base: 5, category: '行动' },
  { key: 'dodge', label: '闪避', base: 'DEX/2', category: '战斗' },
  { key: 'drive_auto', label: '汽车驾驶', base: 20, category: '行动' },
  { key: 'electrical_repair', label: '电气维修', base: 10, category: '专业' },
  { key: 'fast_talk', label: '话术', base: 5, category: '社交' },
  { key: 'fighting_brawl', label: '格斗(斗殴)', base: 25, category: '战斗' },
  { key: 'fighting_custom', label: '格斗(专门)', base: 1, category: '战斗' },
  { key: 'firearms_handgun', label: '射击(手枪)', base: 20, category: '战斗' },
  { key: 'firearms_rifle_shotgun', label: '射击(步枪/霰弹枪)', base: 25, category: '战斗' },
  { key: 'firearms_custom', label: '射击(专门)', base: 1, category: '战斗' },
  { key: 'first_aid', label: '急救', base: 30, category: '专业' },
  { key: 'history', label: '历史', base: 5, category: '知识' },
  { key: 'hypnosis', label: '催眠', base: 1, category: '专业' },
  { key: 'intimidate', label: '恐吓', base: 15, category: '社交' },
  { key: 'jump', label: '跳跃', base: 20, category: '行动' },
  { key: 'language_own', label: '母语', base: 'EDU', category: '语言' },
  { key: 'language_other', label: '外语', base: 1, category: '语言' },
  { key: 'law', label: '法律', base: 5, category: '知识' },
  { key: 'library_use', label: '图书馆使用', base: 20, category: '调查' },
  { key: 'listen', label: '聆听', base: 20, category: '调查' },
  { key: 'locksmith', label: '锁匠', base: 1, category: '专业' },
  { key: 'mechanical_repair', label: '机械维修', base: 10, category: '专业' },
  { key: 'medicine', label: '医学', base: 1, category: '专业' },
  { key: 'natural_world', label: '博物学', base: 10, category: '知识' },
  { key: 'navigate', label: '导航', base: 10, category: '行动' },
  { key: 'occult', label: '神秘学', base: 5, category: '知识' },
  { key: 'operate_heavy_machinery', label: '操作重型机械', base: 1, category: '行动' },
  { key: 'persuade', label: '说服', base: 10, category: '社交' },
  { key: 'photography', label: '摄影', base: 5, category: '专业' },
  { key: 'pilot', label: '驾驶(飞行/船)', base: 1, category: '行动' },
  { key: 'psychoanalysis', label: '精神分析', base: 1, category: '专业' },
  { key: 'psychology', label: '心理学', base: 10, category: '调查' },
  { key: 'read_lips', label: '读唇', base: 1, category: '专业' },
  { key: 'ride', label: '骑术', base: 5, category: '行动' },
  { key: 'science', label: '科学', base: 1, category: '知识' },
  { key: 'sleight_of_hand', label: '妙手', base: 10, category: '行动' },
  { key: 'spot_hidden', label: '侦查', base: 25, category: '调查' },
  { key: 'stealth', label: '潜行', base: 20, category: '行动' },
  { key: 'survival', label: '生存', base: 10, category: '行动' },
  { key: 'swim', label: '游泳', base: 20, category: '行动' },
  { key: 'throw', label: '投掷', base: 20, category: '行动' },
  { key: 'track', label: '追踪', base: 10, category: '行动' },
]

export const occupationTemplates: OccupationTemplate[] = [
  {
    id: 'journalist',
    name: '记者',
    creditRating: '9-30',
    pointFormula: 'EDU x 4',
    forcedSkills: ['library_use', 'listen', 'psychology', 'spot_hidden', 'fast_talk'],
    recommendedSkills: ['charm', 'language_other', 'history', 'photography', 'persuade'],
    occupationSkillChoices: 2,
    contacts: '报社、警局线人、档案馆、街头消息源。',
    description: '善于调查公开记录、访问目击者并把零散信息拼成故事。',
  },
  {
    id: 'private-investigator',
    name: '私家侦探',
    creditRating: '9-30',
    pointFormula: 'EDU x 2 + DEX x 2',
    forcedSkills: ['spot_hidden', 'locksmith', 'psychology', 'listen', 'fast_talk'],
    recommendedSkills: ['law', 'stealth', 'firearms_handgun', 'disguise', 'persuade'],
    occupationSkillChoices: 2,
    contacts: '委托人、警局旧识、旅馆老板、律师。',
    description: '适合潜入、跟踪、盘问和在灰色地带寻找证据。',
  },
  {
    id: 'antiquarian',
    name: '古物研究者',
    creditRating: '30-70',
    pointFormula: 'EDU x 4',
    forcedSkills: ['appraise', 'art_craft', 'history', 'library_use', 'spot_hidden'],
    recommendedSkills: ['archaeology', 'language_other', 'occult', 'persuade', 'anthropology'],
    occupationSkillChoices: 2,
    contacts: '大学、博物馆、拍卖行、收藏家。',
    description: '擅长辨识文献、年代、收藏品和不该被打开的箱子。',
  },
  {
    id: 'doctor',
    name: '医生',
    creditRating: '30-80',
    pointFormula: 'EDU x 4',
    forcedSkills: ['first_aid', 'medicine', 'psychology', 'science', 'library_use'],
    recommendedSkills: ['listen', 'persuade', 'language_other', 'psychoanalysis'],
    occupationSkillChoices: 2,
    contacts: '医院、诊所、药剂师、殡仪馆。',
    description: '能稳定队伍状态，也容易被卷入异常病例和隐秘病历。',
  },
  {
    id: 'accountant',
    name: '会计师',
    creditRating: '30-70',
    pointFormula: 'EDU x 4',
    forcedSkills: ['accounting', 'law', 'library_use', 'listen', 'persuade', 'spot_hidden'],
    recommendedSkills: ['psychology', 'appraise', 'language_other', 'fast_talk'],
    occupationSkillChoices: 2,
    contacts: '银行、律所、账房、税务机构。',
    description: '来自 Excel 职业列表：适合审计账本、发现资金异常和追踪可疑交易。',
  },
  {
    id: 'acrobat',
    name: '杂技演员',
    creditRating: '9-20',
    pointFormula: 'EDU x 2 + DEX x 2',
    forcedSkills: ['climb', 'dodge', 'jump', 'throw', 'spot_hidden', 'swim'],
    recommendedSkills: ['charm', 'disguise', 'fighting_brawl', 'stealth'],
    occupationSkillChoices: 2,
    contacts: '马戏团、剧院、巡演队伍、街头艺人。',
    description: '来自 Excel 职业列表：行动能力强，适合危险地形和追逐场景。',
  },
  {
    id: 'actor-stage',
    name: '演员-戏剧演员',
    creditRating: '9-40',
    pointFormula: 'EDU x 2 + APP x 2',
    forcedSkills: ['art_craft', 'disguise', 'fighting_brawl', 'history', 'psychology'],
    recommendedSkills: ['charm', 'fast_talk', 'intimidate', 'persuade', 'language_other'],
    occupationSkillChoices: 3,
    contacts: '剧院、赞助人、剧评人、演出经纪。',
    description: '来自 Excel 职业列表：擅长表演、社交伪装和读取人群反应。',
  },
]

const excelRequiredSections = [
  '调查员信息',
  '职业与信用评级',
  '属性',
  '派生属性',
  '技能基础值',
  '技能职业加点',
  '技能兴趣加点',
  '背景故事',
  '资产与装备',
  '武器/护甲',
]

function d6(): number {
  return Math.floor(Math.random() * 6) + 1
}

function roll(times: number): number {
  return Array.from({ length: times }, d6).reduce((sum, value) => sum + value, 0)
}

export function randomCharacteristics(): Characteristics {
  return {
    str: roll(3) * 5,
    con: roll(3) * 5,
    siz: (roll(2) + 6) * 5,
    dex: roll(3) * 5,
    app: roll(3) * 5,
    int: (roll(2) + 6) * 5,
    pow: roll(3) * 5,
    edu: (roll(2) + 6) * 5,
  }
}

export function clampCharacteristic(value: number): number {
  return Math.max(15, Math.min(90, Math.round(value / 5) * 5))
}

export function deriveHp(characteristics: Characteristics): number {
  return Math.floor((characteristics.con + characteristics.siz) / 10)
}

export function deriveMp(characteristics: Characteristics): number {
  return Math.floor(characteristics.pow / 5)
}

export function deriveMov(characteristics: Characteristics, age: number): number {
  let mov = characteristics.dex > characteristics.siz && characteristics.str > characteristics.siz ? 9 : characteristics.dex >= characteristics.siz || characteristics.str >= characteristics.siz ? 8 : 7
  if (age >= 40) mov = mov - Math.floor(age / 10) + 3
  return Math.max(0, mov)
}

export function deriveBuildAndDb(characteristics: Characteristics): { build: number; damageBonus: string } {
  const sum = characteristics.str + characteristics.siz
  if (sum <= 64) return { build: -2, damageBonus: '-2' }
  if (sum <= 84) return { build: -1, damageBonus: '-1' }
  if (sum <= 124) return { build: 0, damageBonus: '0' }
  if (sum <= 164) return { build: 1, damageBonus: '+1D4' }
  if (sum <= 204) return { build: 2, damageBonus: '+1D6' }
  return { build: Math.floor((sum - 45) / 80) + 1, damageBonus: '+2D6+' }
}

export function baseSkillValue(skill: SkillTemplate, characteristics: Characteristics): number {
  if (skill.base === 'DEX/2') return Math.floor(characteristics.dex / 2)
  if (skill.base === 'EDU') return characteristics.edu
  if (skill.base === 'POW') return characteristics.pow
  if (skill.base === 'STR') return characteristics.str
  return skill.base
}

export function occupationPoints(occupation: OccupationTemplate, c: Characteristics): number {
  switch (occupation.id) {
    case 'private-investigator':
    case 'acrobat':
      return c.edu * 2 + c.dex * 2
    case 'actor-stage':
      return c.edu * 2 + c.app * 2
    default:
      return c.edu * 4
  }
}

export function personalInterestPoints(c: Characteristics): number {
  return c.int * 2
}

export function occupationLimit(occupation: OccupationTemplate): number {
  return occupation.forcedSkills.length + occupation.occupationSkillChoices
}

export function initialSkillAllocations(
  occupation: OccupationTemplate,
  characteristics: Characteristics,
): SkillAllocation[] {
  const initialChoices = occupation.recommendedSkills.slice(0, occupation.occupationSkillChoices)
  const occupationKeys = new Set([...occupation.forcedSkills, ...initialChoices])
  const forcedKeys = new Set(occupation.forcedSkills)
  return skillTemplates.map((skill) => ({
    key: skill.key,
    label: skill.label,
    category: skill.category,
    base: baseSkillValue(skill, characteristics),
    occupationAdded: 0,
    interestAdded: 0,
    final: baseSkillValue(skill, characteristics),
    isOccupation: occupationKeys.has(skill.key),
    forcedOccupation: forcedKeys.has(skill.key),
  }))
}

export function recalculateSkillAllocations(
  allocations: SkillAllocation[],
  characteristics: Characteristics,
): SkillAllocation[] {
  return allocations.map((allocation) => {
    const template = skillTemplates.find((skill) => skill.key === allocation.key)
    const base = template ? baseSkillValue(template, characteristics) : allocation.base
    return {
      ...allocation,
      base,
      final: Math.max(0, Math.min(99, base + allocation.occupationAdded + allocation.interestAdded)),
    }
  })
}

export function autoAllocateSkills(
  occupation: OccupationTemplate,
  characteristics: Characteristics,
): SkillAllocation[] {
  const allocations = initialSkillAllocations(occupation, characteristics)
  const occupationBudget = occupationPoints(occupation, characteristics)
  const interestBudget = personalInterestPoints(characteristics)
  const occupationTargets = allocations.filter((skill) => skill.isOccupation && !['sanity', 'strength'].includes(skill.key))
  const occupationShare = Math.floor(occupationBudget / Math.max(occupationTargets.length, 1))

  for (const skill of occupationTargets) {
    skill.occupationAdded = Math.min(55, occupationShare)
  }

  const interestTargets = ['spot_hidden', 'listen', 'dodge', 'stealth', 'persuade']
    .map((key) => allocations.find((skill) => skill.key === key))
    .filter((skill): skill is SkillAllocation => Boolean(skill))
  const interestShare = Math.floor(interestBudget / Math.max(interestTargets.length, 1))
  for (const skill of interestTargets) {
    skill.interestAdded = Math.min(35, interestShare)
  }

  return recalculateSkillAllocations(allocations, characteristics)
}

export function allocationsToSkillMap(allocations: SkillAllocation[]): Partial<Record<SkillKey, number>> {
  return Object.fromEntries(allocations.map((skill) => [skill.key, skill.final]))
}

export function usedOccupationSkillPoints(allocations: SkillAllocation[]): number {
  return allocations.reduce((sum, skill) => sum + Math.max(0, skill.occupationAdded), 0)
}

export function usedInterestSkillPoints(allocations: SkillAllocation[]): number {
  return allocations.reduce((sum, skill) => sum + Math.max(0, skill.interestAdded), 0)
}

export function selectedOccupationSkillCount(allocations: SkillAllocation[]): number {
  return allocations.filter((skill) => skill.isOccupation).length
}

export function auditCharacterDraft(params: {
  name: string
  age: number
  occupation: OccupationTemplate
  characteristics: Characteristics
  allocations: SkillAllocation[]
  backstory?: Character['backstory']
  extras?: CharacterSheetExtras
  pointPool: number
  mode: 'point-buy' | 'random'
}): CreationAudit {
  const missing: string[] = []
  const warnings: string[] = []
  const characteristicTotal = Object.values(params.characteristics).reduce((sum, value) => sum + value, 0)
  const occupationUsed = usedOccupationSkillPoints(params.allocations)
  const interestUsed = usedInterestSkillPoints(params.allocations)
  const selectedCount = selectedOccupationSkillCount(params.allocations)
  const requiredOccupationCount = occupationLimit(params.occupation)

  if (!params.name.trim()) missing.push('姓名')
  if (!params.age || params.age < 15) missing.push('有效年龄')
  if (!params.occupation) missing.push('职业')
  if (selectedCount !== requiredOccupationCount) missing.push(`职业技能选择数量：需要 ${requiredOccupationCount} 项，当前 ${selectedCount} 项`)
  if (params.mode === 'point-buy' && characteristicTotal > params.pointPool) missing.push(`属性购点超支：${characteristicTotal}/${params.pointPool}`)
  if (occupationUsed > occupationPoints(params.occupation, params.characteristics)) missing.push(`职业技能点超支：${occupationUsed}/${occupationPoints(params.occupation, params.characteristics)}`)
  if (interestUsed > personalInterestPoints(params.characteristics)) missing.push(`兴趣技能点超支：${interestUsed}/${personalInterestPoints(params.characteristics)}`)
  if (!params.backstory?.personalDescription) warnings.push('背景描述尚未填写')
  if (!params.backstory?.ideology) warnings.push('思想与信念尚未填写')
  if (!params.backstory?.significantPeople) warnings.push('重要之人尚未填写')
  if (!params.backstory?.meaningfulLocations) warnings.push('意义非凡之地尚未填写')
  if (!params.backstory?.treasuredPossessions) warnings.push('宝贵之物尚未填写')
  if (!params.backstory?.traits) warnings.push('特质尚未填写')
  if (!params.backstory?.darkSecret) warnings.push('难言之隐尚未填写')
  if (!params.backstory?.injuriesScars) warnings.push('伤口和疤痕尚未填写')
  if (!params.backstory?.phobiasManias) warnings.push('恐惧症和躁狂症尚未填写')
  if (!params.allocations.some((skill) => skill.key === 'credit_rating' && skill.final > 0)) warnings.push('信用评级仍为 0，可参考职业 CR 范围填写')
  if (!params.extras?.cash && !params.extras?.assets && !params.extras?.spendingLevel) warnings.push('资产、现金或消费水平尚未填写')
  if (!params.extras?.equipment) warnings.push('装备栏尚未填写')
  if (!params.extras?.weapons && !params.extras?.armor) warnings.push('武器/护甲栏尚未填写')

  const coveredSections = new Set([
    '调查员信息',
    '职业与信用评级',
    '属性',
    '派生属性',
    '技能基础值',
    '技能职业加点',
    '技能兴趣加点',
    params.backstory?.personalDescription ? '背景故事' : '',
    params.extras?.equipment || params.extras?.cash || params.extras?.assets ? '资产与装备' : '',
    params.extras?.weapons || params.extras?.armor ? '武器/护甲' : '',
  ])
  for (const section of excelRequiredSections) {
    if (!coveredSections.has(section)) warnings.push(`Excel 对照项待完善：${section}`)
  }

  return {
    source: 'coc七版规则空白卡cy20.02.2.xlsx / 人物卡、职业列表、属性注释、技能注释',
    checkedAt: new Date().toISOString(),
    missing,
    warnings: Array.from(new Set(warnings)),
  }
}

export function createCharacter(params: {
  name: string
  player?: string
  age: number
  sex: string
  residence: string
  birthplace: string
  occupation: OccupationTemplate
  characteristics: Characteristics
  allocations: SkillAllocation[]
  backstory?: Character['backstory']
  extras?: CharacterSheetExtras
  audit?: CreationAudit
}): Character {
  const hp = deriveHp(params.characteristics)
  const mp = deriveMp(params.characteristics)
  const mov = deriveMov(params.characteristics, params.age)
  const { build, damageBonus } = deriveBuildAndDb(params.characteristics)
  const skills = allocationsToSkillMap(params.allocations)

  return {
    id: crypto.randomUUID(),
    name: params.name || '未命名调查员',
    player: params.player,
    type: 'investigator',
    role: params.occupation.name,
    age: params.age,
    sex: params.sex,
    residence: params.residence,
    birthplace: params.birthplace,
    characteristics: params.characteristics,
    hp,
    hpMax: hp,
    san: params.characteristics.pow,
    sanMax: 99,
    mp,
    luck: params.characteristics.pow,
    dex: params.characteristics.dex,
    mov,
    build,
    damageBonus,
    occupationPoints: occupationPoints(params.occupation, params.characteristics),
    personalInterestPoints: personalInterestPoints(params.characteristics),
    skills,
    skillBreakdown: params.allocations,
    creationAudit: params.audit,
    sheetExtras: params.extras,
    conditions: [],
    backstory: params.backstory,
    privateNotes: `Created with ${params.occupation.name} template. CR ${params.occupation.creditRating}.`,
  }
}

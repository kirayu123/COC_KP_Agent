import type { Character, SkillKey } from '../types'

type ImportResult = {
  characters: Character[]
  warnings: string[]
}

const skillAliases: Record<SkillKey, string[]> = {
  spot_hidden: ['spot hidden', 'spot_hidden', '侦查', '偵查', '目星', '看破', 'spot'],
  locksmith: ['locksmith', '锁匠', '鎖匠', '开锁', '開鎖'],
  library_use: ['library use', 'library_use', '图书馆使用', '圖書館使用', '图书馆', '圖書館', 'library'],
  listen: ['listen', '聆听', '聆聽', '倾听', '傾聽', '听力'],
  psychology: ['psychology', '心理学', '心理學'],
  fast_talk: ['fast talk', 'fast_talk', '话术', '話術', '快速交谈', '快速交談'],
  dodge: ['dodge', '闪避', '閃避'],
  sanity: ['sanity', 'san', '理智'],
  strength: ['strength', 'str', '力量'],
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const match = value.match(/\d+/)
      if (match) return Number(match[0])
    }
  }
  return undefined
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[（）()]/g, ' ').replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchSkillKey(name: string): SkillKey | undefined {
  const normalized = normalizeName(name)
  return (Object.keys(skillAliases) as SkillKey[]).find((key) =>
    skillAliases[key].some((alias) => normalized.includes(normalizeName(alias))),
  )
}

function readSkillValue(raw: unknown): number | undefined {
  const item = asRecord(raw)
  return firstNumber(item.value, item.current, item.total, item.score, item.rank, item.level, raw)
}

function collectSkillsFromArray(rawSkills: unknown): Partial<Record<SkillKey, number>> {
  const skills: Partial<Record<SkillKey, number>> = {}
  if (!Array.isArray(rawSkills)) return skills

  for (const raw of rawSkills) {
    const item = asRecord(raw)
    const name = firstString(item.name, item.skillName, item.key, item.subskill, item.label)
    const key = item.key && typeof item.key === 'string' ? matchSkillKey(item.key) : name ? matchSkillKey(name) : undefined
    const value = readSkillValue(raw)
    if (key && value !== undefined) skills[key] = value
  }

  return skills
}

function collectSkillsFromObject(rawSkills: unknown): Partial<Record<SkillKey, number>> {
  const skills: Partial<Record<SkillKey, number>> = {}
  const source = asRecord(rawSkills)

  for (const [name, value] of Object.entries(source)) {
    const key = matchSkillKey(name)
    const skillValue = readSkillValue(value)
    if (key && skillValue !== undefined) skills[key] = skillValue
  }

  return skills
}

function mergeSkills(...sources: Partial<Record<SkillKey, number>>[]): Partial<Record<SkillKey, number>> {
  return Object.assign({}, ...sources)
}

function characterFromCthulhuEditor(raw: Record<string, unknown>): Character | undefined {
  const identity = asRecord(raw.identity)
  const trackers = asRecord(raw.trackers)
  const characteristics = asRecord(raw.characteristics)
  const skills = collectSkillsFromArray(raw.skills)
  const name = firstString(identity.name, raw.name)
  if (!name) return undefined

  return {
    id: crypto.randomUUID(),
    name,
    player: firstString(identity.player),
    type: 'investigator',
    role: firstString(identity.occupation, raw.occupation) ?? '调查员',
    hp: firstNumber(trackers.hp) ?? 10,
    hpMax: firstNumber(trackers.hpMax, trackers.hp) ?? 10,
    san: firstNumber(trackers.sanity, trackers.san) ?? 50,
    sanMax: firstNumber(trackers.sanityMax, trackers.sanity, trackers.san) ?? 99,
    mp: firstNumber(trackers.mp) ?? 10,
    luck: firstNumber(trackers.luck) ?? 50,
    dex: firstNumber(characteristics.dex, characteristics.DEX) ?? 50,
    skills,
    conditions: [
      trackers.majorWound ? '重伤' : '',
      trackers.tempInsane ? '临时疯狂' : '',
      trackers.indefInsane ? '不定性疯狂' : '',
    ].filter(Boolean),
    privateNotes: firstString(raw.notes),
  }
}

function characterFromDholesHouse(raw: Record<string, unknown>): Character | undefined {
  const investigator = asRecord(raw.Investigator ?? raw.investigator ?? raw)
  const personal = asRecord(investigator.PersonalDetails ?? investigator.personalDetails ?? investigator.Identity)
  const characteristics = asRecord(investigator.Characteristics ?? investigator.characteristics)
  const attributes = asRecord(investigator.Attributes ?? investigator.attributes)
  const skillsNode = asRecord(investigator.Skills ?? investigator.skills)
  const skillArray = skillsNode.Skill ?? skillsNode.skill ?? investigator.skills
  const skills = mergeSkills(collectSkillsFromArray(skillArray), collectSkillsFromObject(skillArray))
  const name = firstString(personal.Name, personal.name, investigator.Name, investigator.name)
  if (!name) return undefined

  return {
    id: crypto.randomUUID(),
    name,
    player: firstString(personal.Player, personal.player),
    type: 'investigator',
    role: firstString(personal.Occupation, personal.occupation, investigator.Occupation) ?? '调查员',
    hp: firstNumber(attributes.HitPoints, attributes.hp, attributes.HP, investigator.HP) ?? 10,
    hpMax: firstNumber(attributes.HitPointsMax, attributes.hpMax, attributes.HPMax, attributes.HitPoints) ?? 10,
    san: firstNumber(attributes.Sanity, attributes.sanity, attributes.SAN, investigator.SAN) ?? 50,
    sanMax: firstNumber(attributes.SanityMax, attributes.sanMax) ?? 99,
    mp: firstNumber(attributes.MagicPoints, attributes.mp, attributes.MP) ?? 10,
    luck: firstNumber(attributes.Luck, attributes.luck, characteristics.Luck, characteristics.luck) ?? 50,
    dex: firstNumber(characteristics.DEX, characteristics.dex, characteristics.Dexterity, characteristics.dexterity) ?? 50,
    skills,
    conditions: [],
    privateNotes: 'Imported from Dhole-like JSON.',
  }
}

function characterFromGenericJson(raw: Record<string, unknown>): Character | undefined {
  const system = asRecord(raw.system)
  const attribs = asRecord(system.attribs)
  const characteristics = asRecord(system.characteristics ?? raw.characteristics)
  const skills = mergeSkills(collectSkillsFromObject(raw.skills), collectSkillsFromObject(system.skills), collectSkillsFromArray(raw.skills))
  const name = firstString(raw.name, raw.charName, raw.characterName, system.name)
  if (!name) return undefined

  return {
    id: crypto.randomUUID(),
    name,
    player: firstString(raw.player, system.player),
    type: 'investigator',
    role: firstString(raw.occupation, raw.role, system.occupation) ?? '调查员',
    hp: firstNumber(raw.hp, attribs.hp, asRecord(attribs.hp).value) ?? 10,
    hpMax: firstNumber(raw.hpMax, asRecord(attribs.hp).max, raw.hp) ?? 10,
    san: firstNumber(raw.san, raw.sanity, attribs.san, asRecord(attribs.san).value) ?? 50,
    sanMax: firstNumber(raw.sanMax, asRecord(attribs.san).max) ?? 99,
    mp: firstNumber(raw.mp, attribs.mp, asRecord(attribs.mp).value) ?? 10,
    luck: firstNumber(raw.luck, attribs.lck, asRecord(attribs.lck).value) ?? 50,
    dex: firstNumber(raw.dex, characteristics.dex, asRecord(characteristics.dex).value) ?? 50,
    skills,
    conditions: Array.isArray(raw.conditions) ? raw.conditions.map(String) : [],
    privateNotes: firstString(raw.notes, raw.privateNotes),
  }
}

function parseMarkdownCharacter(text: string): Character | undefined {
  const field = (labels: string[]) => {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${escaped}\\s*[:：]\\s*(.+)`, 'i'))
      if (match?.[1]) return match[1].trim()
    }
    return undefined
  }
  const numberField = (labels: string[]) => firstNumber(field(labels))
  const name = field(['姓名', 'Name', '调查员', 'Investigator'])
  if (!name) return undefined
  const skills: Partial<Record<SkillKey, number>> = {}
  for (const key of Object.keys(skillAliases) as SkillKey[]) {
    const value = numberField(skillAliases[key])
    if (value !== undefined) skills[key] = value
  }

  return {
    id: crypto.randomUUID(),
    name,
    player: field(['玩家', 'Player']),
    type: 'investigator',
    role: field(['职业', 'Occupation', '身份', 'Role']) ?? '调查员',
    hp: numberField(['HP', '体力', '生命值']) ?? 10,
    hpMax: numberField(['HP上限', 'Max HP', '体力上限']) ?? numberField(['HP', '体力', '生命值']) ?? 10,
    san: numberField(['SAN', 'Sanity', '理智']) ?? 50,
    sanMax: numberField(['SAN上限', 'Max SAN', '理智上限']) ?? 99,
    mp: numberField(['MP', 'Magic Points', '魔法值']) ?? 10,
    luck: numberField(['Luck', '幸运', '幸運']) ?? 50,
    dex: numberField(['DEX', '敏捷']) ?? 50,
    skills,
    conditions: [],
    privateNotes: 'Imported from Markdown/text.',
  }
}

function flattenCandidateCharacters(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.flatMap(flattenCandidateCharacters)
  const item = asRecord(raw)
  const maybeList = item.characters ?? item.investigators ?? item.actors
  if (Array.isArray(maybeList)) return maybeList.flatMap(flattenCandidateCharacters)
  return Object.keys(item).length ? [item] : []
}

export function importCharactersFromText(text: string): ImportResult {
  const warnings: string[] = []
  const trimmed = text.trim()
  if (!trimmed) return { characters: [], warnings: ['没有可导入的内容。'] }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const characters = flattenCandidateCharacters(parsed)
      .map((raw) => characterFromCthulhuEditor(raw) ?? characterFromDholesHouse(raw) ?? characterFromGenericJson(raw))
      .filter((character): character is Character => Boolean(character))

    if (characters.length) return { characters, warnings }
    warnings.push('JSON 已读取，但没有识别出支持的人物卡字段。')
  } catch {
    const character = parseMarkdownCharacter(trimmed)
    if (character) return { characters: [character], warnings }
    warnings.push('内容不是可识别的 JSON，也没有识别出 Markdown 人物卡字段。')
  }

  return { characters: [], warnings }
}

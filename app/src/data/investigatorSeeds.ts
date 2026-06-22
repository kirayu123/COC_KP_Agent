import linYunSheet from '../../server/data/kp-agent/liaoque_huanmeng/investigators/pc-liaoqie-lin-yun.json'
import maraKleinSheet from '../../server/data/kp-agent/liaoque_huanmeng/investigators/pc-liaoqie-mara-klein.json'
import qiaoMilesSheet from '../../server/data/kp-agent/liaoque_huanmeng/investigators/pc-liaoqie-qiao-miles.json'
import xuJingshuSheet from '../../server/data/kp-agent/liaoque_huanmeng/investigators/pc-liaoqie-xu-jingshu.json'
import type { Character, SkillKey } from '../types'

type InvestigatorJson = {
  id: string
  name: string
  player?: string
  type: 'investigator'
  occupation: string
  age?: number
  sex?: string
  residence?: string
  birthplace?: string
  status: {
    hp: { current: number; max: number }
    san: { current: number; max: number }
    mp: { current: number }
    luck: number
    conditions: string[]
  }
  characteristics: NonNullable<Character['characteristics']>
  derived?: {
    mov?: number
    build?: number
    damageBonus?: string
  }
  skills: Array<{
    key: SkillKey
    final: number
  }>
  equipment?: string[]
  appearance?: string
  background?: Partial<NonNullable<Character['backstory']>>
  privateNotes?: string
}

const investigatorSheets = [
  linYunSheet,
  xuJingshuSheet,
  qiaoMilesSheet,
  maraKleinSheet,
] as InvestigatorJson[]

function text(value: string | undefined) {
  return value ?? ''
}

function skillsFromSheet(sheet: InvestigatorJson): Character['skills'] {
  const skills: Character['skills'] = {}
  for (const skill of sheet.skills) {
    skills[skill.key] = skill.final
  }
  skills.sanity = sheet.status.san.current
  return skills
}

function backstoryFromSheet(sheet: InvestigatorJson): Character['backstory'] {
  const background = sheet.background ?? {}
  return {
    ideology: text(background.ideology),
    significantPeople: text(background.significantPeople),
    meaningfulLocations: text(background.meaningfulLocations),
    treasuredPossessions: text(background.treasuredPossessions),
    traits: text(background.traits),
    darkSecret: background.darkSecret,
    injuriesScars: text(background.injuriesScars),
    phobiasManias: text(background.phobiasManias),
    personalDescription: text(background.personalDescription),
    investigatorExperiences: background.investigatorExperiences,
    mythosEncounters: background.mythosEncounters,
    spells: background.spells,
    allies: background.allies,
  }
}

function investigatorFromSheet(sheet: InvestigatorJson): Character {
  return {
    id: sheet.id,
    name: sheet.name,
    player: sheet.player,
    type: 'investigator',
    role: sheet.occupation,
    age: sheet.age,
    sex: sheet.sex,
    residence: sheet.residence,
    birthplace: sheet.birthplace,
    characteristics: sheet.characteristics,
    hp: sheet.status.hp.current,
    hpMax: sheet.status.hp.max,
    san: sheet.status.san.current,
    sanMax: sheet.status.san.max,
    mp: sheet.status.mp.current,
    luck: sheet.status.luck,
    dex: sheet.characteristics.dex,
    mov: sheet.derived?.mov,
    build: sheet.derived?.build,
    damageBonus: sheet.derived?.damageBonus,
    skills: skillsFromSheet(sheet),
    conditions: sheet.status.conditions,
    sheetExtras: {
      era: '1920s',
      equipment: sheet.equipment?.join('、'),
      portraitNote: sheet.appearance,
    },
    backstory: backstoryFromSheet(sheet),
    privateNotes: sheet.privateNotes,
  }
}

export const demoInvestigators: Character[] = investigatorSheets.map(investigatorFromSheet)

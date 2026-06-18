export type StoryNodeStatus = 'locked' | 'available' | 'active' | 'completed' | 'danger' | 'optional' | 'unavailable'

export type StoryClue = {
  title: string
  state: 'hidden' | 'available' | 'revealed' | 'understood' | 'missed'
  playerText: string
  keeperText: string
}

export type StoryNode = {
  id: string
  title: string
  kind: 'intro' | 'investigation' | 'research' | 'social' | 'search' | 'combat' | 'finale' | 'event'
  status: StoryNodeStatus
  phase: string
  location: string
  x?: number
  y?: number
  keyPlot: string[]
  clues: StoryClue[]
  rewards: string[]
  risks: string[]
  npcs: string[]
  checks: string[]
  materials: string[]
  keeperNote: string
  playerSummary: string
}

export type StoryEdge = {
  from: string
  to: string
  label: string
  strength: 'main' | 'alternate' | 'optional' | 'danger'
  completed?: boolean
}

export type InvestigatorTrack = {
  id: string
  fallbackName: string
  role: string
  locationNodeId: string
  hp: string
  san: string
  mp: string
  conditions: string[]
  carried: string[]
  lastAction: string
}

export type ModuleClock = {
  title: string
  current: number
  max: number
  consequence: string
}

export const storyNodes: StoryNode[] = [
  {
    id: 'scene-resnick-death',
    title: '雷斯尼克死亡现场',
    kind: 'intro',
    status: 'completed',
    phase: '导入',
    location: '校外公寓 / 验尸官办公室',
    x: 10, y: 45,
    keyPlot: ['发现黑舌尸体', '确认死因不明', '找到小玻璃瓶'],
    clues: [
      {
        title: '小玻璃瓶',
        state: 'revealed',
        playerText: '现场散落小瓶，瓶中残留黑色液体。',
        keeperText: '黑色液体是黑血，后续可引向实验室检验和校园成瘾者。',
      },
      {
        title: '邻居证词',
        state: 'available',
        playerText: '邻居似乎知道雷斯尼克死前的异常。',
        keeperText: '心理学或社交检定可得到噩梦、尖叫和性情变化的信息。',
      },
    ],
    rewards: ['解锁校园调查', '解锁黑血检验'],
    risks: ['看到尸体需理智检定 0/1D4', '非法闯入会留下警方风险'],
    npcs: ['沃尔特·雷斯尼克', '托马斯·斯旺森', '验尸官'],
    checks: ['侦察', '医学', '司法科学', '心理学', '锁匠', '力量'],
    materials: [],
    keeperNote: '这是模组入口，把恐怖感停在"异常死亡和黑色残留物"，不要直接揭示多佛。',
    playerSummary: '调查员已确认死亡现场不自然，并拿到了黑色残留物。',
  },
  {
    id: 'scene-campus-inquiry',
    title: '校园调查',
    kind: 'investigation',
    status: 'completed',
    phase: '初步调查',
    location: '大学校园',
    x: 25, y: 28,
    keyPlot: ['打听坏学生圈子', '得知更多黑舌死亡', '听到保罗·罗杰斯的名字'],
    clues: [
      {
        title: '保罗·罗杰斯',
        state: 'understood',
        playerText: '多名学生提到罗杰斯曾回校园兜售新东西。',
        keeperText: '罗杰斯是中间人，玩家不应在此直接拿到多佛姓名。',
      },
      {
        title: '校园恐慌',
        state: 'revealed',
        playerText: '连续死亡让校园气氛非常紧张。',
        keeperText: '玩家行动过激时推进校园恐慌钟或触发校方安保。',
      },
    ],
    rewards: ['解锁寻找保罗·罗杰斯', '可获得其他受害者信息'],
    risks: ['校方安保盘问', '瘾君子索要金钱或拒绝透露供应者'],
    npcs: ['黑血成瘾学生', '教授', '校方安保'],
    checks: ['魅惑', '话术', '说服', '恐吓', '侦察', '医学', '心理学'],
    materials: [],
    keeperNote: '重点是把玩家导向罗杰斯，同时制造校园公共压力。',
    playerSummary: '调查员已知黑血在校园传播，并锁定罗杰斯这条线。',
  },
  {
    id: 'scene-black-blood-analysis',
    title: '黑血检验',
    kind: 'research',
    status: 'active',
    phase: '初步调查',
    location: '实验室 / 医疗机构',
    x: 25, y: 65,
    keyPlot: ['分析黑色液体', '发现未知生物成分', '黑血短暂活动'],
    clues: [
      {
        title: '未知活性物质',
        state: 'revealed',
        playerText: '黑色残留物不是普通毒品，含有无法归类的活性成分。',
        keeperText: '第一次研究时可触发黑血蠕动，引发 0/1D2 理智损失。',
      },
    ],
    rewards: ['确认黑血并非普通药物', '为后续法术和弱点埋伏笔', '可引出调查雅各布·多佛'],
    risks: ['理智检定 0/1D2', '玩家可能尝试服用黑血'],
    npcs: ['验尸官', '实验室协助者'],
    checks: ['生物学', '化学', '药学'],
    materials: [],
    keeperNote: '如果玩家卡住，可用检验报告补足"它不是常规毒品"的关键信息。',
    playerSummary: '调查员掌握了黑血样本，并发现它有非自然性质。',
  },
  {
    id: 'scene-find-paul-rogers',
    title: '寻找保罗·罗杰斯',
    kind: 'social',
    status: 'active',
    phase: '深入调查',
    location: '市政厅 / 校园 / 街区',
    x: 42, y: 38,
    keyPlot: ['查税务记录', '监视校园交易', '跟踪罗杰斯'],
    clues: [
      {
        title: '罗杰斯住址',
        state: 'available',
        playerText: '市政记录或跟踪行动可以定位他的住处。',
        keeperText: '失败不应卡死，可改为第二天在校园交易时看到他。',
      },
    ],
    rewards: ['解锁罗杰斯住处', '可直接跟踪到屠宰场', '触发死从天降事件'],
    risks: ['跟踪失败会让罗杰斯警觉', '罗杰斯拒绝供出幕后老板'],
    npcs: ['保罗·罗杰斯', '黑血购买者'],
    checks: ['图书馆使用', '潜行', '伪装', '话术', '汽车驾驶'],
    materials: [],
    keeperNote: '罗杰斯是桥梁，不是终点。保持他对多佛的恐惧感。',
    playerSummary: '调查员正在追踪黑血的校园供应者。',
  },
  {
    id: 'scene-jacob-dover-inquiry',
    title: '调查雅各布·多佛',
    kind: 'investigation',
    status: 'available',
    phase: '深入调查',
    location: '报纸档案馆 / 市政记录',
    x: 42, y: 72,
    keyPlot: ['查阅信用记录', '搜索报纸档案', '定位多佛住址'],
    clues: [
      {
        title: '多佛地址',
        state: 'available',
        playerText: '多佛曾在贫民区有登记住址。',
        keeperText: '这是通往多佛公寓的直接线索，可绕过罗杰斯获取。',
      },
      {
        title: '多佛家族背景',
        state: 'hidden',
        playerText: '多佛家族在本地有一定历史。',
        keeperText: '报纸档案可找到乔纳森·多佛的死亡记录和遗留财产信息。',
      },
    ],
    rewards: ['解锁多佛公寓（独立路线）', '了解多佛家族与黑血的关联'],
    risks: ['线索模糊，可能需要多次检定', '调查过深会引起多佛注意'],
    npcs: ['档案管理员', '街区居民'],
    checks: ['图书馆使用', '话术', '魅惑', '幸运'],
    materials: [],
    keeperNote: '这是从神话角度切入的独立路线，适合专注研究的调查员。',
    playerSummary: '调查员正试图通过公开记录锁定多佛。',
  },
  {
    id: 'scene-rogers-house',
    title: '罗杰斯住处',
    kind: 'search',
    status: 'available',
    phase: '深入调查',
    location: '郊区小屋',
    x: 58, y: 16,
    keyPlot: ['趁罗杰斯外出搜查', '找到鞋底污物', '发现屠宰场草稿纸'],
    clues: [
      {
        title: '鞋底污物',
        state: 'available',
        playerText: '鞋底沾有动物排泄物和血污。',
        keeperText: '这是通往坎普贝尔肉类处理厂的关键地点线索。',
      },
      {
        title: '草稿纸地址',
        state: 'hidden',
        playerText: '废纸篓中有写了一半的地址。',
        keeperText: '侦察或幸运成功时可找到屠宰场完整地址。',
      },
    ],
    rewards: ['解锁废弃屠宰场', '获得罗杰斯施压筹码'],
    risks: ['非法入侵', '罗杰斯警觉', '证物链被污染'],
    npcs: ['保罗·罗杰斯', '莱斯利'],
    checks: ['锁匠', '力量', '侦察', '生物学', '化学', '医学', '潜行'],
    materials: [],
    keeperNote: '如果玩家明确搜索厨房或后门，优先给出鞋底污物；否则让侦察决定发现程度。',
    playerSummary: '该地点尚未进入，是从罗杰斯线通向终局的重要桥。',
  },
  {
    id: 'scene-death-from-above',
    title: '死从天降',
    kind: 'event',
    status: 'optional',
    phase: '变局',
    location: '夜间街道 / 校园附近',
    x: 58, y: 48,
    keyPlot: ['夜魇袭击并杀死罗杰斯', '奥谢也可能遭到袭击', '多佛派出夜魇灭口'],
    clues: [
      {
        title: '夜魇爪痕',
        state: 'hidden',
        playerText: '尸体上有非人类留下的撕裂伤。',
        keeperText: '可引向神话知识检定，揭示夜魇存在，为终局做铺垫。',
      },
    ],
    rewards: ['理智损失奖励神话知识 +2', '证明多佛已在清理线索'],
    risks: ['调查员目睹可能触发理智检定 0/1D6', '罗杰斯死亡后审问路线关闭'],
    npcs: ['保罗·罗杰斯（受害者）', '夜魇', '奥谢（可能受害）'],
    checks: ['侦察', '神话学', '医学', '心理学'],
    materials: [],
    keeperNote: '此事件触发后，场景"审问罗杰斯"变为不可用（灰色）。根据玩家节奏决定是否触发。',
    playerSummary: '这是一个可能发生的关键变局，会让罗杰斯路线失效。',
  },
  {
    id: 'scene-dover-apartment',
    title: '多佛公寓',
    kind: 'search',
    status: 'available',
    phase: '逼近真相',
    location: '贫民区公寓楼',
    x: 62, y: 80,
    keyPlot: ['搜到乔纳森·多佛日志', '了解多佛家背景', '发现黑血弱点'],
    clues: [
      {
        title: '乔纳森·多佛日志',
        state: 'hidden',
        playerText: '一本旧日志可能解释黑血来源。',
        keeperText: '阅读会带来神话知识、理智损失、法术信息和流水弱点。',
      },
    ],
    rewards: ['得知黑血弱点（流水）', '可学习呼唤黑血', '解锁多佛动机'],
    risks: ['威利斯·卡特可能听见动静', '研究日志理智损失 1/1D6'],
    npcs: ['雅各布·多佛', '威利斯·卡特'],
    checks: ['锁匠', '力量', '潜行', '幸运', '侦察', '图书馆使用'],
    materials: ['展示材料：幻梦1'],
    keeperNote: '把日志内容拆成逐步揭示，不要一次性倾倒。这是理解真相的关键节点。',
    playerSummary: '该地点可让调查员真正理解多佛、黑血和神话来源。',
  },
  {
    id: 'scene-rogers-interrogated',
    title: '审问罗杰斯',
    kind: 'social',
    status: 'available',
    phase: '逼近真相',
    location: '罗杰斯住处 / 秘密接触点',
    x: 76, y: 22,
    keyPlot: ['在住处或街头逮住罗杰斯', '施压或说服获得屠宰场地点', '了解多佛的控制手段'],
    clues: [
      {
        title: '屠宰场地点',
        state: 'available',
        playerText: '罗杰斯在压力下说出货源地点。',
        keeperText: '成功时直接解锁终局；失败时罗杰斯给出模糊方向，需配合其他线索拼合。',
      },
      {
        title: '多佛威胁',
        state: 'hidden',
        playerText: '罗杰斯表现出对幕后老板的极度恐惧。',
        keeperText: '心理学或说服成功时可探知多佛的黑血控制能力。',
      },
    ],
    rewards: ['直接解锁废弃屠宰场', '了解多佛对供应链的控制'],
    risks: ['罗杰斯拒绝合作', '罗杰斯向多佛告密', '审问过激引起警方关注'],
    npcs: ['保罗·罗杰斯'],
    checks: ['恐吓', '说服', '话术', '心理学', '力量'],
    materials: [],
    keeperNote: '这是死从天降未触发时的主要路线。罗杰斯害怕多佛胜过害怕调查员，需要强力检定或特殊筹码。',
    playerSummary: '调查员试图从罗杰斯口中得到最终地点。',
  },
  {
    id: 'scene-rogers-dead',
    title: '罗杰斯被夜魇杀死',
    kind: 'event',
    status: 'unavailable',
    phase: '变局（未触发）',
    location: '夜间街道',
    x: 76, y: 54,
    keyPlot: ['此路线本轮未发生', '死从天降事件未触发', '罗杰斯仍然存活'],
    clues: [],
    rewards: [],
    risks: [],
    npcs: ['保罗·罗杰斯'],
    checks: [],
    materials: [],
    keeperNote: '若死从天降触发，此节点变为 completed，审问罗杰斯变为 unavailable。',
    playerSummary: '本局罗杰斯尚未死亡，此时间线已关闭。',
  },
  {
    id: 'scene-final-slaughterhouse',
    title: '废弃屠宰场摊牌',
    kind: 'finale',
    status: 'danger',
    phase: '摊牌',
    location: '坎普贝尔肉类处理厂',
    x: 90, y: 42,
    keyPlot: ['发现黑血储藏', '对抗多佛和黑仆', '夜魇或可选怪物登场'],
    clues: [
      {
        title: '黑血储藏桶',
        state: 'hidden',
        playerText: '屠宰场深处藏有黑血来源。',
        keeperText: '可被流水消解，若启用可选怪物则可能诞生腥首乌骸。',
      },
    ],
    rewards: ['制止黑血交易 +1D4 SAN', '解决多佛 +1D4 SAN', '解决夜魇 +1D6 SAN'],
    risks: ['多敌人战斗', '高处坠落', '夜魇偷袭', '可选腥首乌骸可能团灭'],
    npcs: ['雅各布·多佛', '威利斯·卡特', '黑仆', '夜魇', '腥首乌骸'],
    checks: ['潜行', '侦察', '闪避', '格斗', '射击', '理智'],
    materials: ['地图：了却幻梦'],
    keeperNote: '这是高风险终局。根据队伍强度决定夜魇数量和是否启用腥首乌骸。',
    playerSummary: '终局地点标记为高危险，玩家尚未真正进入。',
  },
]

export const storyEdges: StoryEdge[] = [
  { from: 'scene-resnick-death', to: 'scene-campus-inquiry', label: '同学与死者变化', strength: 'main', completed: true },
  { from: 'scene-resnick-death', to: 'scene-black-blood-analysis', label: '小瓶残留物', strength: 'main', completed: true },
  { from: 'scene-campus-inquiry', to: 'scene-find-paul-rogers', label: '保罗·罗杰斯', strength: 'main', completed: true },
  { from: 'scene-black-blood-analysis', to: 'scene-jacob-dover-inquiry', label: '神话性质→供应者', strength: 'alternate' },
  { from: 'scene-find-paul-rogers', to: 'scene-rogers-house', label: '税务记录 / 跟踪', strength: 'main' },
  { from: 'scene-find-paul-rogers', to: 'scene-death-from-above', label: '多佛灭口', strength: 'optional' },
  { from: 'scene-find-paul-rogers', to: 'scene-final-slaughterhouse', label: '直接跟踪交易', strength: 'danger' },
  { from: 'scene-jacob-dover-inquiry', to: 'scene-dover-apartment', label: '公开记录定位', strength: 'main' },
  { from: 'scene-rogers-house', to: 'scene-rogers-interrogated', label: '守株待兔', strength: 'main' },
  { from: 'scene-rogers-house', to: 'scene-final-slaughterhouse', label: '鞋底污物', strength: 'alternate' },
  { from: 'scene-death-from-above', to: 'scene-rogers-dead', label: '夜魇杀死罗杰斯', strength: 'danger' },
  { from: 'scene-death-from-above', to: 'scene-final-slaughterhouse', label: '追踪夜魇来源', strength: 'danger' },
  { from: 'scene-rogers-interrogated', to: 'scene-final-slaughterhouse', label: '供出屠宰场', strength: 'main' },
  { from: 'scene-dover-apartment', to: 'scene-final-slaughterhouse', label: '日志与转让线索', strength: 'alternate' },
]

export const investigatorTracks: InvestigatorTrack[] = [
  {
    id: 'track-1',
    fallbackName: '林医生',
    role: '医学顾问',
    locationNodeId: 'scene-black-blood-analysis',
    hp: '11/12',
    san: '55/60',
    mp: '11',
    conditions: ['紧张', '持有样本'],
    carried: ['黑血小瓶', '尸检摘记'],
    lastAction: '正在尝试确认黑血成分。',
  },
  {
    id: 'track-2',
    fallbackName: '乔侦探',
    role: '私家侦探',
    locationNodeId: 'scene-find-paul-rogers',
    hp: '12/12',
    san: '61/70',
    mp: '10',
    conditions: ['单独行动'],
    carried: ['罗杰斯外貌描述', '校园访谈记录'],
    lastAction: '在校园附近盯梢罗杰斯。',
  },
  {
    id: 'track-3',
    fallbackName: '许记者',
    role: '记者',
    locationNodeId: 'scene-campus-inquiry',
    hp: '10/10',
    san: '49/55',
    mp: '9',
    conditions: ['被校方注意'],
    carried: ['死亡学生名单'],
    lastAction: '继续追问坏学生圈子的传闻。',
  },
]

export const moduleClocks: ModuleClock[] = [
  { title: '校园恐慌', current: 3, max: 6, consequence: '达到 6 时校方会强行限制外部调查。' },
  { title: '罗杰斯警觉', current: 2, max: 4, consequence: '达到 4 时罗杰斯改变路线并减少校园交易。' },
  { title: '多佛反制', current: 1, max: 5, consequence: '达到 5 时多佛派夜魇主动处理调查员。' },
  { title: '黑血扩散', current: 3, max: 8, consequence: '达到 8 时出现新的黑舌死亡者。' },
]

export const completedBeats = [
  '第 1 天 20:10 发现雷斯尼克尸体，确认黑舌与小瓶。',
  '第 1 天 21:00 询问邻居，得知死前噩梦和尖叫。',
  '第 2 天 10:30 校园调查，锁定保罗·罗杰斯。',
  '第 2 天 14:20 实验室检验黑血，发现未知活性成分。',
  '第 2 天 17:40 乔侦探开始在校园附近盯梢罗杰斯。',
]

export const initialStoryGraphState = {
  nodeStatuses: Object.fromEntries(
    storyNodes.map((n, i) => [n.id, i === 0 ? 'active' : 'locked'])
  ),
  clueStates: Object.fromEntries(
    storyNodes.flatMap((n) => n.clues.map((c) => [`${n.id}::${c.title}`, 'hidden']))
  ),
}

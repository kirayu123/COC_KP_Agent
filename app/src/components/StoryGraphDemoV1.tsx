import { useMemo, useState } from 'react'
import type { CampaignState } from '../types'
import {
  completedBeats,
  investigatorTracks,
  moduleClocks,
  storyEdges,
  storyNodes,
  type StoryClue,
  type StoryNode,
} from '../data/storyGraphDemo'

type Props = {
  campaign: CampaignState
}

const statusLabels: Record<StoryNode['status'], string> = {
  locked: '未接触',
  available: '可前往',
  active: '进行中',
  completed: '已完成',
  danger: '高危险',
  optional: '可选',
  unavailable: '已关闭',
}

const clueStateLabels: Record<StoryClue['state'], string> = {
  hidden: '隐藏',
  available: '可发现',
  revealed: '已揭示',
  understood: '已理解',
  missed: '错过',
}

function displayCharacterName(character: { name: string } | undefined, fallback: string) {
  if (!character) return fallback
  if (/[鏋涔闆妗璋鍞]/.test(character.name)) return fallback
  return character.name
}

function nodeById(id: string) {
  return storyNodes.find((node) => node.id === id) ?? storyNodes[0]
}

export function StoryGraphDemoV1({ campaign }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState('scene-black-blood-analysis')
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(investigatorTracks[0]?.id ?? null)
  const selectedNode = nodeById(selectedNodeId)
  const selectedTrack = investigatorTracks.find((track) => track.id === selectedTrackId)
  const investigatorNodeIds = new Set(investigatorTracks.map((track) => track.locationNodeId))

  const moduleStats = useMemo(() => {
    const completed = storyNodes.filter((node) => node.status === 'completed').length
    const danger = storyNodes.filter((node) => node.status === 'danger').length
    const revealedClues = storyNodes.flatMap((node) => node.clues).filter((clue) => clue.state === 'revealed' || clue.state === 'understood').length
    const totalClues = storyNodes.flatMap((node) => node.clues).length
    return { completed, danger, revealedClues, totalClues }
  }, [])

  return (
    <section className="story-page" aria-label="剧情图谱">
      <header className="story-overview">
        <div>
          <p className="eyebrow">Keeper Map</p>
          <h2>了却幻梦 · 剧情图谱</h2>
        </div>
        <div className="story-metrics" aria-label="模组整体进行情况">
          <Metric label="阶段" value="深入调查" />
          <Metric label="场景" value={`${moduleStats.completed}/${storyNodes.length}`} />
          <Metric label="线索" value={`${moduleStats.revealedClues}/${moduleStats.totalClues}`} />
          <Metric label="危险" value={moduleStats.danger} />
        </div>
      </header>

      <div className="story-layout">
        <aside className="story-investigators" aria-label="调查员位置与状态">
          <SectionTitle title="调查员态势" detail="点击后高亮其所在地点" />
          <div className="investigator-stack">
            {investigatorTracks.map((track, index) => {
              const character = campaign.characters.filter((item) => item.type === 'investigator')[index]
              const location = nodeById(track.locationNodeId)
              const active = selectedTrackId === track.id
              return (
                <button
                  className={`investigator-state ${active ? 'is-active' : ''}`}
                  type="button"
                  key={track.id}
                  onClick={() => {
                    setSelectedTrackId(track.id)
                    setSelectedNodeId(track.locationNodeId)
                  }}
                >
                  <div>
                    <h3>{displayCharacterName(character, track.fallbackName)}</h3>
                    <p>{track.role}</p>
                  </div>
                  <span className="location-chip">{location.title}</span>
                  <dl className="mini-stats">
                    <Metric label="HP" value={character ? `${character.hp}/${character.hpMax}` : track.hp} />
                    <Metric label="SAN" value={character ? `${character.san}/${character.sanMax}` : track.san} />
                    <Metric label="MP" value={character?.mp ?? track.mp} />
                  </dl>
                  <div className="story-tags">
                    {track.conditions.map((condition) => (
                      <span key={condition}>{condition}</span>
                    ))}
                  </div>
                  <p className="state-note">{track.lastAction}</p>
                </button>
              )
            })}
          </div>

          <div className="story-side-block">
            <SectionTitle title="压力钟" detail="世界如何回应玩家" />
            <div className="module-clock-stack">
              {moduleClocks.map((clock) => (
                <article className="module-clock" key={clock.title}>
                  <div>
                    <h3>{clock.title}</h3>
                    <p>{clock.consequence}</p>
                  </div>
                  <div className="module-clock-bar" aria-label={`${clock.current}/${clock.max}`}>
                    <span style={{ width: `${(clock.current / clock.max) * 100}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <section className="story-map-panel" aria-label="剧情流程地图">
          <div className="map-toolbar">
            <div>
              <SectionTitle title="实时剧情流程" detail="粗线为已完成走向，虚线为替代或危险路径" />
            </div>
            <div className="map-legend" aria-label="节点状态说明">
              <span className="legend-completed">已完成</span>
              <span className="legend-active">进行中</span>
              <span className="legend-available">可前往</span>
              <span className="legend-danger">危险</span>
            </div>
          </div>

          <div className="story-map-viewport">
            <div className="story-map-canvas">
              <svg className="story-edges" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
                {storyEdges.map((edge) => {
                  const from = nodeById(edge.from)
                  const to = nodeById(edge.to)
                  return (
                    <line
                      className={`edge-line edge-${edge.strength} ${edge.completed ? 'is-completed' : ''}`}
                      key={`${edge.from}-${edge.to}`}
                      x1={from.x ?? 50}
                      y1={from.y ?? 50}
                      x2={to.x ?? 50}
                      y2={to.y ?? 50}
                    />
                  )
                })}
              </svg>

              <div className="edge-label-layer" aria-hidden="true">
                {storyEdges.map((edge) => {
                  const from = nodeById(edge.from)
                  const to = nodeById(edge.to)
                  return (
                    <span
                      className={`edge-label edge-${edge.strength} ${edge.completed ? 'is-completed' : ''}`}
                      key={`${edge.from}-${edge.to}-label`}
                      style={{ left: `${((from.x ?? 50) + (to.x ?? 50)) / 2}%`, top: `${((from.y ?? 50) + (to.y ?? 50)) / 2}%` }}
                    >
                      {edge.label}
                    </span>
                  )
                })}
              </div>

              {storyNodes.map((node) => {
                const selected = selectedNode.id === node.id
                const occupied = investigatorNodeIds.has(node.id)
                const focusedByInvestigator = selectedTrack?.locationNodeId === node.id
                const revealedClues = node.clues.filter((clue) => clue.state === 'revealed' || clue.state === 'understood').length
                return (
                  <button
                    className={`story-node is-${node.status} ${selected ? 'is-selected' : ''} ${occupied ? 'has-investigator' : ''} ${
                      focusedByInvestigator ? 'is-focused-by-investigator' : ''
                    }`}
                    type="button"
                    key={node.id}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <span className="node-status">
                      <i />
                      {statusLabels[node.status]}
                    </span>
                    <strong>{node.title}</strong>
                    <small>{node.location}</small>
                    <span className="node-meta">
                      <i />
                      {node.phase} · {revealedClues}/{node.clues.length} 线索
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="completed-beats">
            <SectionTitle title="已完成剧本走向" detail="这条线是本桌实际跑出来的历史" />
            <ol>
              {completedBeats.map((beat) => (
                <li key={beat}>{beat}</li>
              ))}
            </ol>
          </div>
        </section>

        <aside className="story-location-detail" aria-label="剧情地点详情">
          <div className="detail-head">
            <div>
              <p className="eyebrow">{selectedNode.phase}</p>
              <h2>{selectedNode.title}</h2>
            </div>
            <span className={`status-pill is-${selectedNode.status}`}>{statusLabels[selectedNode.status]}</span>
          </div>

          <div className="detail-location">
            <span>地点</span>
            <strong>{selectedNode.location}</strong>
          </div>

          <DetailBlock title="关键剧情" items={selectedNode.keyPlot} />

          <section className="detail-block">
            <h3>线索状态</h3>
            <div className="clue-state-stack">
              {selectedNode.clues.map((clue) => (
                <article className={`graph-clue is-${clue.state}`} key={clue.title}>
                  <div>
                    <h4>{clue.title}</h4>
                    <span>{clueStateLabels[clue.state]}</span>
                  </div>
                  <p>{clue.playerText}</p>
                  <small>KP：{clue.keeperText}</small>
                </article>
              ))}
            </div>
          </section>

          <div className="detail-two-col">
            <DetailBlock title="NPC / 怪物" items={selectedNode.npcs} />
            <DetailBlock title="检定卡" items={selectedNode.checks} />
          </div>

          {selectedNode.materials.length > 0 && <DetailBlock title="展示材料" items={selectedNode.materials} />}
          <DetailBlock title="奖励 / 推进" items={selectedNode.rewards} />
          <DetailBlock title="风险" items={selectedNode.risks} tone="danger" />

          <section className="detail-block keeper-note">
            <h3>KP 私密提示</h3>
            <p>{selectedNode.keeperNote}</p>
          </section>
        </aside>
      </div>
    </section>
  )
}

function SectionTitle(props: { title: string; detail?: string }) {
  return (
    <div className="section-title">
      <h2>{props.title}</h2>
      {props.detail && <p>{props.detail}</p>}
    </div>
  )
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function DetailBlock(props: { title: string; items: string[]; tone?: 'danger' }) {
  return (
    <section className={`detail-block ${props.tone === 'danger' ? 'is-danger' : ''}`}>
      <h3>{props.title}</h3>
      <ul>
        {props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

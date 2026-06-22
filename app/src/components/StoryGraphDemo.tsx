import dagre from '@dagrejs/dagre'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CampaignState, Character } from '../types'
import {
  completedBeats,
  investigatorTracks,
  moduleClocks,
  storyEdges,
  storyNodes,
  type StoryClue,
  type StoryClueState,
  type StoryNode,
  type StoryNodeStatus,
} from '../data/storyGraphDemo'

type Props = { campaign: CampaignState }
type Transform = { x: number; y: number; scale: number }
type Pt = { x: number; y: number }

const NODE_W = 180
const NODE_H = 122

const statusLabels: Record<StoryNodeStatus, string> = {
  locked: '未接触',
  available: '可前往',
  active: '进行中',
  completed: '已完成',
  danger: '高危险',
  optional: '可选',
  unavailable: '已关闭',
}

const clueStateLabels: Record<StoryClueState, string> = {
  hidden: '隐藏',
  available: '可发现',
  revealed: '已揭示',
  understood: '已理解',
  missed: '错过',
}

function displayCharacterName(character: Character | undefined, fallback: string) {
  if (!character) return fallback
  if (/[鏋涔闆妗璋鍞]/.test(character.name)) return fallback
  return character.name
}

function nodeById(id: string) {
  return storyNodes.find((n) => n.id === id) ?? storyNodes[0]
}

function pointsToPath(pts: Pt[]): string {
  if (pts.length < 2) return ''
  const [s, ...rest] = pts
  const cmds: string[] = [`M ${s.x} ${s.y}`]
  for (let i = 0; i < rest.length - 1; i++) {
    const mid = { x: (rest[i].x + rest[i + 1].x) / 2, y: (rest[i].y + rest[i + 1].y) / 2 }
    cmds.push(`Q ${rest[i].x} ${rest[i].y} ${mid.x} ${mid.y}`)
  }
  const last = rest[rest.length - 1]
  cmds.push(`L ${last.x} ${last.y}`)
  return cmds.join(' ')
}

function useLayout() {
  return useMemo(() => {
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 140, marginx: 60, marginy: 60 })
    g.setDefaultEdgeLabel(() => ({}))
    storyNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
    storyEdges.forEach((e) => g.setEdge(e.from, e.to))
    dagre.layout(g)
    const nodePos = new Map(storyNodes.map((n) => [n.id, g.node(n.id) as { x: number; y: number }]))
    const edgePaths = new Map(
      storyEdges.map((e) => [(g.edge(e.from, e.to)?.points ?? []) as Pt[], e] as const)
    )
    const graph = g.graph()
    return {
      nodePos,
      edgePaths,
      width: (graph.width ?? 1200) + 120,
      height: (graph.height ?? 600) + 120,
    }
  }, [])
}

export function StoryGraphDemo({ campaign }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState(storyNodes[0]?.id ?? '')
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(investigatorTracks[0]?.id ?? null)
  const [transform, setTransform] = useState<Transform>({ x: 20, y: 20, scale: 0.72 })

  const { nodePos, edgePaths, width, height } = useLayout()

  const viewportRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef(transform)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const sg = campaign.storyGraph
  const initialNode = storyNodes[0]
  const initialGraphIsActive =
    Boolean(initialNode && sg?.nodeStatuses[initialNode.id] === 'active') &&
    storyNodes.slice(1).every((node) => sg?.nodeStatuses[node.id] === 'locked')
  const effectiveSelectedNodeId = initialGraphIsActive && initialNode ? initialNode.id : selectedNodeId
  const selectedNode = nodeById(effectiveSelectedNodeId)
  const selectedTrack = investigatorTracks.find((t) => t.id === selectedTrackId)
  const investigatorNodeIds = new Set(investigatorTracks.map((t) => t.locationNodeId))

  function defaultNodeStatus(node: StoryNode): StoryNodeStatus {
    return node.id === storyNodes[0]?.id ? 'active' : 'locked'
  }

  function nodeStatus(node: StoryNode): StoryNodeStatus {
    return (sg?.nodeStatuses[node.id] ?? defaultNodeStatus(node)) as StoryNodeStatus
  }
  function clueState(nodeId: string, clue: StoryClue) {
    return (sg?.clueStates[`${nodeId}::${clue.title}`] ?? 'hidden') as StoryClueState
  }
  function edgeCompleted(edge: (typeof storyEdges)[number]) {
    const from = nodeById(edge.from)
    const to = nodeById(edge.to)
    return nodeStatus(from) === 'completed' && nodeStatus(to) !== 'locked' && nodeStatus(to) !== 'unavailable'
  }

  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  const moduleStats = useMemo(() => {
    const completed = storyNodes.filter((n) => nodeStatus(n) === 'completed').length
    const danger = storyNodes.filter((n) => nodeStatus(n) === 'danger').length
    const phase = storyNodes.find((node) => nodeStatus(node) === 'active')?.phase ?? selectedNode.phase
    const revealedClues = storyNodes.reduce((count, node) => {
      return count + node.clues.filter((clue) => {
        const state = clueState(node.id, clue)
        return state === 'revealed' || state === 'understood'
      }).length
    }, 0)
    const totalClues = storyNodes.flatMap((n) => n.clues).length
    return { completed, danger, revealedClues, totalClues, phase }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sg, selectedNode.phase])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const t = transformRef.current
      const newScale = Math.max(0.2, Math.min(4, t.scale * (e.deltaY < 0 ? 1.12 : 0.893)))
      const ratio = newScale / t.scale
      setTransform({ scale: newScale, x: mx - ratio * (mx - t.x), y: my - ratio * (my - t.y) })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as Element).closest('.story-node')) return
    isDragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }

  function stopDrag() { isDragging.current = false }

  return (
    <section className="story-page-v2" aria-label="剧情图谱">
      <header className="story-overview">
        <div>
          <p className="eyebrow">Keeper Map v2</p>
          <h2>了却幻梦 · 剧情图谱</h2>
        </div>
        <div className="story-metrics">
          <Metric label="阶段" value={moduleStats.phase} />
          <Metric label="场景" value={`${moduleStats.completed}/${storyNodes.length}`} />
          <Metric label="线索" value={`${moduleStats.revealedClues}/${moduleStats.totalClues}`} />
          <Metric label="危险" value={moduleStats.danger} />
        </div>
      </header>

      <div className="story-layout-v2">
        <aside className="story-side-panel" aria-label="调查员位置与状态">
          <SectionTitle title="调查员态势" detail="点击后高亮节点" />
          <div className="investigator-stack">
            {investigatorTracks.map((track, index) => {
              const character = campaign.characters.filter((c) => c.type === 'investigator')[index]
              const location = nodeById(track.locationNodeId)
              const active = selectedTrackId === track.id
              return (
                <button
                  className={`investigator-state ${active ? 'is-active' : ''}`}
                  type="button"
                  key={track.id}
                  onClick={() => { setSelectedTrackId(track.id); setSelectedNodeId(track.locationNodeId) }}
                >
                  <div><h3>{displayCharacterName(character, track.fallbackName)}</h3><p>{track.role}</p></div>
                  <span className="location-chip">{location.title}</span>
                  <dl className="mini-stats">
                    <Metric label="HP" value={character ? `${character.hp}/${character.hpMax}` : track.hp} />
                    <Metric label="SAN" value={character ? `${character.san}/${character.sanMax}` : track.san} />
                    <Metric label="MP" value={character?.mp ?? track.mp} />
                  </dl>
                  <div className="story-tags">{track.conditions.map((c) => <span key={c}>{c}</span>)}</div>
                  <p className="state-note">{track.lastAction}</p>
                </button>
              )
            })}
          </div>

          <div className="story-side-block">
            <SectionTitle title="压力钟" />
            <div className="module-clock-stack">
              {moduleClocks.map((clock) => (
                <article className="module-clock" key={clock.title}>
                  <div><h3>{clock.title}</h3><p>{clock.consequence}</p></div>
                  <div className="module-clock-bar" aria-label={`${clock.current}/${clock.max}`}>
                    <span style={{ width: `${(clock.current / clock.max) * 100}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="story-side-block">
            <SectionTitle title="已完成走向" />
            <ol className="completed-beats-list">
              {completedBeats.length ? completedBeats.map((beat) => <li key={beat}>{beat}</li>) : <li>暂无已完成走向。</li>}
            </ol>
          </div>
        </aside>

        <div className="canvas-col">
          <div className="map-legend-bar" aria-label="节点状态说明">
            <SectionTitle title="实时剧情流程" detail="滚轮缩放 · 拖拽移动" />
            <div className="map-legend">
              <span className="legend-completed">已完成</span>
              <span className="legend-active">进行中</span>
              <span className="legend-available">可前往</span>
              <span className="legend-danger">危险</span>
              <span className="legend-unavailable">已关闭</span>
            </div>
          </div>

          <div
            ref={viewportRef}
            className="canvas-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            <div
              className="canvas-inner"
              style={{ width, height, transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})` }}
            >
              <svg
                className="story-edges"
                style={{ width, height }}
                aria-hidden="true"
              >
                <defs>
                  <marker id="arr-main" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,1 L0,6 L6,3.5 z" className="arr arr-main" />
                  </marker>
                  <marker id="arr-alt" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,1 L0,6 L6,3.5 z" className="arr arr-alt" />
                  </marker>
                  <marker id="arr-danger" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,1 L0,6 L6,3.5 z" className="arr arr-danger" />
                  </marker>
                </defs>
                {Array.from(edgePaths.entries()).map(([pts, edge]) => {
                  const d = pointsToPath(pts)
                  const mid = pts[Math.floor(pts.length / 2)] ?? { x: 0, y: 0 }
                  const isAlt = edge.strength === 'alternate' || edge.strength === 'optional'
                  const isDanger = edge.strength === 'danger'
                  const markerId = isDanger ? 'arr-danger' : isAlt ? 'arr-alt' : 'arr-main'
                  const key = `${edge.from}__${edge.to}`
                  return (
                    <g key={key}>
                      <path
                        className={`edge-path edge-${edge.strength}${edgeCompleted(edge) ? ' is-completed' : ''}`}
                        d={d}
                        fill="none"
                        markerEnd={`url(#${markerId})`}
                      />
                      {edge.label && (
                        <text
                          className={`edge-text edge-${edge.strength}${edgeCompleted(edge) ? ' is-completed' : ''}`}
                          x={mid.x} y={mid.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >{edge.label}</text>
                      )}
                    </g>
                  )
                })}
              </svg>

              {storyNodes.map((node) => {
                const pos = nodePos.get(node.id)
                if (!pos) return null
                const status = nodeStatus(node)
                const selected = selectedNode.id === node.id
                const occupied = investigatorNodeIds.has(node.id)
                const focused = selectedTrack?.locationNodeId === node.id
                const revealedClues = node.clues.filter((c) => { const s = clueState(node.id, c); return s === 'revealed' || s === 'understood' }).length
                return (
                  <button
                    className={`story-node is-${status}${selected ? ' is-selected' : ''}${occupied ? ' has-investigator' : ''}${focused ? ' is-focused-by-investigator' : ''}`}
                    type="button"
                    key={node.id}
                    style={{ left: pos.x, top: pos.y }}
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <span className="node-status"><i />{statusLabels[status]}</span>
                    <strong>{node.title}</strong>
                    <small>{node.location}</small>
                    <span className="node-meta"><i />{node.phase} · {revealedClues}/{node.clues.length} 线索</span>
                  </button>
                )
              })}
            </div>

            <div className="canvas-controls" aria-label="缩放控制">
              <button type="button" onClick={() => setTransform((t) => ({ ...t, scale: Math.min(4, t.scale * 1.2) }))}>+</button>
              <button type="button" onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.2, t.scale * 0.833) }))}>&minus;</button>
              <button type="button" onClick={() => setTransform({ x: 20, y: 20, scale: 0.72 })} title="重置视图">⊙</button>
            </div>
          </div>
        </div>

        <aside className="story-side-panel story-detail-panel" aria-label="剧情地点详情">
          <div className="detail-head">
            <div><p className="eyebrow">{selectedNode.phase}</p><h2>{selectedNode.title}</h2></div>
            <span className={`status-pill is-${nodeStatus(selectedNode)}`}>{statusLabels[nodeStatus(selectedNode)]}</span>
          </div>
          <div className="detail-location"><span>地点</span><strong>{selectedNode.location}</strong></div>
          <DetailBlock title="关键剧情" items={selectedNode.keyPlot} />
          <section className="detail-block">
            <h3>线索状态</h3>
            <div className="clue-state-stack">
              {selectedNode.clues.map((clue) => {
                const state = clueState(selectedNode.id, clue)
                return (
                  <article className={`graph-clue is-${state}`} key={clue.title}>
                    <div><h4>{clue.title}</h4><span>{clueStateLabels[state]}</span></div>
                    <p>{clue.playerText}</p>
                    <small>KP：{clue.keeperText}</small>
                  </article>
                )
              })}
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
    <div><span>{props.label}</span><strong>{props.value}</strong></div>
  )
}

function DetailBlock(props: { title: string; items: string[]; tone?: 'danger' }) {
  return (
    <section className={`detail-block${props.tone === 'danger' ? ' is-danger' : ''}`}>
      <h3>{props.title}</h3>
      <ul>{props.items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  )
}

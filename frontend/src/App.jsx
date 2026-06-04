import { useState, useRef, useCallback } from 'react'

const API_BASE = ''

// ── Palette & tokens ──────────────────────────────────────────────
const C = {
  bg: '#0a0a0f',
  surface: '#111118',
  border: '#1e1e2e',
  borderBright: '#2d2d45',
  text: '#e8e6f0',
  muted: '#6b6880',
  accent: '#c8b5ff',
  accentDim: '#7c6aad',
  green: '#4ade80',
  yellow: '#facc15',
  red: '#f87171',
  orange: '#fb923c',
  blue: '#60a5fa',
}

const VERDICT_CONFIG = {
  supported: { label: 'Supported', color: C.green, bg: '#052e16', icon: '✓' },
  partially_supported: { label: 'Partial', color: C.yellow, bg: '#1c1a00', icon: '◑' },
  unsupported: { label: 'Unsupported', color: C.red, bg: '#2d0a0a', icon: '✗' },
  cannot_determine: { label: 'Undetermined', color: C.muted, bg: '#111118', icon: '?' },
}

const INTEGRITY_COLORS = (score) => {
  if (score >= 90) return C.green
  if (score >= 70) return C.yellow
  if (score >= 50) return C.orange
  return C.red
}

// ── Subcomponents ─────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32,
        background: `conic-gradient(from 0deg, ${C.accent}, ${C.accentDim}, ${C.accent})`,
        borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, color: '#0a0a0f',
        fontFamily: 'Syne, sans-serif',
      }}>C</div>
      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: C.text, letterSpacing: '-0.5px' }}>
        Cite<span style={{ color: C.accent }}>Claim</span>
      </span>
    </div>
  )
}

function UploadZone({ onUpload, loading }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = useCallback((file) => {
    if (file && file.type === 'application/pdf') onUpload(file)
  }, [onUpload])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? C.accent : C.borderBright}`,
        borderRadius: 16,
        padding: '60px 40px',
        textAlign: 'center',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: dragging ? '#16122a' : C.surface,
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle grid background */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      <div style={{ fontSize: 48, marginBottom: 16, filter: loading ? 'grayscale(1)' : 'none' }}>📄</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>
        {loading ? 'Analyzing…' : 'Drop a research paper here'}
      </div>
      <div style={{ fontFamily: 'Newsreader, serif', color: C.muted, fontSize: 15 }}>
        PDF files only · Max 20MB
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  )
}

function AgentPipeline({ stage }) {
  const agents = [
    { id: 'extractor', label: 'EXTRACTOR', desc: 'Pulling cited claims' },
    { id: 'resolver', label: 'RESOLVER', desc: 'Resolving citations' },
    { id: 'fetcher', label: 'FETCHER', desc: 'Retrieving papers' },
    { id: 'verifier', label: 'VERIFIER', desc: 'Checking claims' },
    { id: 'summarizer', label: 'SUMMARIZER', desc: 'Writing report' },
  ]

  const stageIndex = agents.findIndex(a => a.id === stage)

  return (
    <div style={{ margin: '32px 0', padding: '24px', background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: C.accentDim, letterSpacing: 2, marginBottom: 20, textTransform: 'uppercase' }}>
        5-Agent Pipeline
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
        {agents.map((agent, i) => {
          const done = stageIndex > i
          const active = stageIndex === i
          return (
            <div key={agent.id} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: done ? C.accent : active ? '#1e1a30' : C.surface,
                  border: `2px solid ${done ? C.accent : active ? C.accentDim : C.borderBright}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 8px',
                  fontSize: 14,
                  transition: 'all 0.3s ease',
                  boxShadow: active ? `0 0 16px ${C.accentDim}66` : 'none',
                }}>
                  {done ? '✓' : active ? <SpinDot /> : <span style={{ color: C.muted, fontSize: 11 }}>{i + 1}</span>}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 500, color: done ? C.accent : active ? C.text : C.muted, letterSpacing: 1 }}>
                  {agent.label}
                </div>
                <div style={{ fontFamily: 'Newsreader, serif', fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {agent.desc}
                </div>
              </div>
              {i < agents.length - 1 && (
                <div style={{ width: 24, height: 2, background: done ? C.accentDim : C.border, flexShrink: 0, transition: 'background 0.3s ease' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SpinDot() {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: `2px solid ${C.accentDim}`,
      borderTopColor: C.accent,
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}

function ScoreMeter({ score, label }) {
  if (score == null) return null
  const color = INTEGRITY_COLORS(score)
  const circumference = 2 * Math.PI * 45
  const offset = circumference * (1 - score / 100)

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={60} cy={60} r={45} fill="none" stroke={C.border} strokeWidth={8} />
        <circle
          cx={60} cy={60} r={45} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{ marginTop: -90, marginBottom: 70, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color }}>
        {score}
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: C.muted, letterSpacing: 1 }}>
        INTEGRITY SCORE
      </div>
      <div style={{
        marginTop: 8, display: 'inline-block',
        padding: '4px 12px', borderRadius: 20,
        background: `${color}22`, border: `1px solid ${color}44`,
        fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 500, color,
      }}>
        {label}
      </div>
    </div>
  )
}

function SummaryBar({ summary, report }) {
  const stats = [
    { key: 'supported', label: 'Supported', color: C.green },
    { key: 'partially_supported', label: 'Partial', color: C.yellow },
    { key: 'unsupported', label: 'Unsupported', color: C.red },
    { key: 'cannot_determine', label: 'Unknown', color: C.muted },
    { key: 'retracted', label: 'Retracted', color: C.orange },
  ]

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: 28, marginBottom: 24,
    }}>
      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {report?.integrity_score != null && (
          <ScoreMeter score={report.integrity_score} label={report.verdict_label} />
        )}

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 16 }}>
            {summary.total} Claims Analyzed
          </div>

          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16, gap: 1 }}>
            {stats.map(s => {
              const pct = summary.total ? (summary[s.key] / summary.total) * 100 : 0
              return pct > 0 ? (
                <div key={s.key} style={{ flex: pct, background: s.color, transition: 'flex 0.8s ease' }} />
              ) : null
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
            {stats.map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: C.muted }}>
                  {s.label}: <span style={{ color: s.color, fontWeight: 500 }}>{summary[s.key]}</span>
                </span>
              </div>
            ))}
          </div>

          {report?.summary && (
            <p style={{ fontFamily: 'Newsreader, serif', fontSize: 15, color: C.muted, marginTop: 16, lineHeight: 1.6, fontStyle: 'italic' }}>
              {report.summary}
            </p>
          )}
        </div>
      </div>

      {report?.key_concerns?.length > 0 && (
        <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.accentDim, letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase' }}>
            Key Concerns
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.key_concerns.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: C.orange, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, marginTop: 1 }}>⚠</span>
                <span style={{ fontFamily: 'Newsreader, serif', fontSize: 14, color: C.text, lineHeight: 1.5 }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report?.recommendation && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#0e1a0e', borderRadius: 8, border: `1px solid ${C.green}33` }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: C.green, letterSpacing: 1 }}>RECOMMENDATION  </span>
          <span style={{ fontFamily: 'Newsreader, serif', fontSize: 14, color: C.text }}>{report.recommendation}</span>
        </div>
      )}
    </div>
  )
}

function ClaimCard({ result, index }) {
  const [expanded, setExpanded] = useState(false)
  const vc = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.cannot_determine

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${result.is_retracted ? C.orange : vc.color}`,
      borderRadius: 10, overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start' }}
      >
        {/* Index */}
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: C.muted,
          minWidth: 24, paddingTop: 2,
        }}>
          {String(index + 1).padStart(2, '0')}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'Newsreader, serif', fontSize: 15, color: C.text,
            lineHeight: 1.6, margin: 0,
            display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {result.claim}
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <code style={{
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
              background: C.border, color: C.accent,
              padding: '2px 8px', borderRadius: 4,
            }}>
              [{result.citation_key}]
            </code>
            {result.resolved_title && (
              <span style={{ fontFamily: 'Newsreader, serif', fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
                {result.resolved_title.slice(0, 60)}{result.resolved_title.length > 60 ? '…' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          {result.is_retracted && (
            <div style={{
              padding: '4px 10px', borderRadius: 20,
              background: `${C.orange}22`, border: `1px solid ${C.orange}55`,
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 500,
              color: C.orange, letterSpacing: 0.5,
            }}>
              RETRACTED
            </div>
          )}
          <div style={{
            padding: '4px 12px', borderRadius: 20,
            background: `${vc.color}1a`, border: `1px solid ${vc.color}44`,
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 500,
            color: vc.color, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>{vc.icon}</span> {vc.label}
          </div>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
            color: C.muted, transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}>▾</div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${C.border}`, padding: '16px 20px 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Confidence bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: C.muted, letterSpacing: 1 }}>CONFIDENCE</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: vc.color }}>{result.confidence}%</span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${result.confidence}%`, background: vc.color, transition: 'width 0.6s ease', borderRadius: 2 }} />
            </div>
          </div>

          {/* Explanation */}
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>EXPLANATION</div>
            <p style={{ fontFamily: 'Newsreader, serif', fontSize: 14, color: C.text, lineHeight: 1.6, margin: 0 }}>
              {result.explanation}
            </p>
          </div>

          {/* Excerpt */}
          {result.excerpt && (
            <div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>RELEVANT EXCERPT</div>
              <blockquote style={{
                fontFamily: 'Newsreader, serif', fontSize: 13, fontStyle: 'italic',
                color: C.muted, borderLeft: `2px solid ${C.accentDim}`,
                paddingLeft: 12, margin: 0, lineHeight: 1.6,
              }}>
                {result.excerpt}
              </blockquote>
            </div>
          )}

          {/* Retraction info */}
          {result.is_retracted && (
            <div style={{ padding: '10px 14px', background: `${C.orange}11`, borderRadius: 8, border: `1px solid ${C.orange}33` }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: C.orange, letterSpacing: 1, marginBottom: 4 }}>⚠ RETRACTION NOTICE</div>
              {result.retraction_date && (
                <p style={{ fontFamily: 'Newsreader, serif', fontSize: 13, color: C.text, margin: '0 0 4px' }}>
                  Retracted: {result.retraction_date}
                </p>
              )}
              {result.retraction_reason && (
                <p style={{ fontFamily: 'Newsreader, serif', fontSize: 13, color: C.muted, margin: 0 }}>
                  Reason: {result.retraction_reason}
                </p>
              )}
            </div>
          )}

          {/* Fetch status */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: C.muted }}>Paper retrieved via:</span>
            <code style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: C.accentDim }}>{result.fetch_status}</code>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultsDashboard({ data }) {
  const [filter, setFilter] = useState('all')

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'unsupported', label: 'Unsupported' },
    { key: 'partially_supported', label: 'Partial' },
    { key: 'supported', label: 'Supported' },
    { key: 'retracted', label: 'Retracted' },
    { key: 'cannot_determine', label: 'Unknown' },
  ]

  const filtered = data.results.filter(r => {
    if (filter === 'all') return true
    if (filter === 'retracted') return r.is_retracted
    return r.verdict === filter
  })

  return (
    <div>
      <SummaryBar summary={data.summary} report={data.integrity_report} />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              border: `1px solid ${filter === f.key ? C.accent : C.border}`,
              background: filter === f.key ? `${C.accent}18` : 'transparent',
              color: filter === f.key ? C.accent : C.muted,
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {f.label}
            <span style={{ marginLeft: 6, opacity: 0.6 }}>
              {f.key === 'all' ? data.results.length
                : f.key === 'retracted' ? data.summary.retracted
                : data.summary[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Claims list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ fontFamily: 'Newsreader, serif', color: C.muted, textAlign: 'center', padding: 40 }}>
            No claims match this filter.
          </div>
        ) : filtered.map((r, i) => (
          <ClaimCard key={i} result={r} index={data.results.indexOf(r)} />
        ))}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState('idle') // idle | loading | done | error
  const [pipelineStage, setPipelineStage] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filename, setFilename] = useState(null)

  const handleUpload = async (file) => {
    setFilename(file.name)
    setState('loading')
    setData(null)
    setError(null)

    // Simulate stage progression while waiting
    const stages = ['extractor', 'resolver', 'fetcher', 'verifier', 'summarizer']
    let si = 0
    setPipelineStage(stages[0])
    const stageTimer = setInterval(() => {
      si = Math.min(si + 1, stages.length - 1)
      setPipelineStage(stages[si])
    }, 4000)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/analyze', { method: 'POST', body: formData })
      clearInterval(stageTimer)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }

      const result = await res.json()
      setData(result)
      setState('done')
    } catch (err) {
      clearInterval(stageTimer)
      setError(err.message)
      setState('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        body { background: ${C.bg}; }
        button { outline: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.borderBright}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
        background: `${C.bg}dd`, backdropFilter: 'blur(12px)',
      }}>
        <Logo />
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: C.muted }}>
          5-Agent Citation Integrity System
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['EXTRACTOR', 'RESOLVER', 'RETRACTION', 'VERIFIER', 'SUMMARIZER'].map(a => (
            <div key={a} style={{
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 9,
              padding: '3px 7px', borderRadius: 4,
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.accentDim, letterSpacing: 0.5,
            }}>{a}</div>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero text — only on idle */}
        {state === 'idle' && (
          <div style={{ marginBottom: 48, animation: 'fadeIn 0.5s ease' }}>
            <h1 style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.1,
              color: C.text, marginBottom: 16,
              letterSpacing: '-1px',
            }}>
              Does this paper mean<br />
              <span style={{
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentDim})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                what they claim it does?
              </span>
            </h1>
            <p style={{ fontFamily: 'Newsreader, serif', fontSize: 18, color: C.muted, lineHeight: 1.7, maxWidth: 560 }}>
              CiteClaim runs five AI agents to extract every cited claim, resolve and fetch cited papers, check for retractions, and verify whether citations actually support what authors say they do.
            </p>

            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              {[
                { icon: '🔍', text: 'Claim extraction' },
                { icon: '🧩', text: 'Citation resolution' },
                { icon: '🚫', text: 'Retraction detection' },
                { icon: '⚖️', text: 'Semantic verification' },
                { icon: '📊', text: 'Integrity scoring' },
              ].map(f => (
                <div key={f.text} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 20,
                  border: `1px solid ${C.border}`, background: C.surface,
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: C.muted,
                }}>
                  <span>{f.icon}</span>{f.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload zone — shown when idle or done */}
        {(state === 'idle' || state === 'done' || state === 'error') && (
          <UploadZone onUpload={handleUpload} loading={false} />
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{
              padding: '20px 24px', background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <SpinDot />
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, color: C.text }}>
                  Analyzing {filename}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: C.muted, marginTop: 2 }}>
                  This may take 30–90 seconds depending on citation count
                </div>
              </div>
            </div>
            <AgentPipeline stage={pipelineStage} />
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div style={{
            marginTop: 24, padding: '16px 20px',
            background: '#2d0a0a', border: `1px solid ${C.red}44`,
            borderRadius: 12, animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: C.red, marginBottom: 4 }}>Analysis failed</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: C.muted }}>{error}</div>
          </div>
        )}

        {/* Results */}
        {state === 'done' && data && (
          <div style={{ marginTop: 40, animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: C.text }}>
                  Results
                </h2>
                <div style={{ fontFamily: 'Newsreader, serif', fontSize: 13, color: C.muted, marginTop: 2, fontStyle: 'italic' }}>
                  {filename}
                </div>
              </div>
              <button
                onClick={() => setState('idle')}
                style={{
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
                  color: C.accentDim, background: 'none',
                  border: `1px solid ${C.borderBright}`, borderRadius: 8,
                  padding: '8px 16px', cursor: 'pointer',
                }}
              >
                ← New Paper
              </button>
            </div>
            <ResultsDashboard data={data} />
          </div>
        )}
      </main>
    </div>
  )
}

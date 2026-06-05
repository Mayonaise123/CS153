import { useState, useRef, useCallback } from 'react'

// ── Design tokens ─────────────────────────────────────────────────
const C = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F4F0',
  border: '#E8E6E0',
  borderStrong: '#D4D0C8',
  text: '#1A1916',
  textMid: '#4A4844',
  textMuted: '#8A8880',
  accent: '#1B4332',
  accentLight: '#D1FAE5',
  accentMid: '#2D6A4F',
  green: '#166534',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
  yellow: '#92400E',
  yellowBg: '#FFFBEB',
  yellowBorder: '#FDE68A',
  red: '#991B1B',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  orange: '#9A3412',
  orangeBg: '#FFF7ED',
  orangeBorder: '#FED7AA',
  gray: '#374151',
  grayBg: '#F9FAFB',
  grayBorder: '#E5E7EB',
}

const VERDICT_CONFIG = {
  supported: {
    label: 'Supported', color: C.green, bg: C.greenBg,
    border: C.greenBorder, icon: '✓', dot: '#16A34A'
  },
  partially_supported: {
    label: 'Partial', color: C.yellow, bg: C.yellowBg,
    border: C.yellowBorder, icon: '◑', dot: '#D97706'
  },
  unsupported: {
    label: 'Unsupported', color: C.red, bg: C.redBg,
    border: C.redBorder, icon: '✗', dot: '#DC2626'
  },
  cannot_determine: {
    label: 'Unverified', color: C.gray, bg: C.grayBg,
    border: C.grayBorder, icon: '–', dot: '#9CA3AF'
  },
}

const scoreColor = (s) => {
  if (s >= 90) return { text: C.green, bg: C.greenBg, border: C.greenBorder }
  if (s >= 70) return { text: C.yellow, bg: C.yellowBg, border: C.yellowBorder }
  if (s >= 50) return { text: C.orange, bg: C.orangeBg, border: C.orangeBorder }
  return { text: C.red, bg: C.redBg, border: C.redBorder }
}

// ── Components ────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: C.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4h10M2 7h7M2 10h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="11" cy="9.5" r="2" stroke="white" strokeWidth="1.2"/>
          <path d="M12.5 11L13.5 12" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
      <span style={{
        fontFamily: 'Spectral, Georgia, serif',
        fontWeight: 700, fontSize: 17,
        color: C.text, letterSpacing: '-0.3px',
      }}>
        CiteClaim
      </span>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: '50%',
      border: `2px solid ${C.border}`,
      borderTopColor: C.accent,
      animation: 'spin 0.8s linear infinite',
      flexShrink: 0,
    }} />
  )
}

function UploadZone({ onUpload, loading }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = useCallback((file) => {
    if (file?.type === 'application/pdf') onUpload(file)
  }, [onUpload])

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
      style={{
        border: `2px dashed ${dragging ? C.accent : C.borderStrong}`,
        borderRadius: 12,
        padding: '52px 40px',
        textAlign: 'center',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: dragging ? '#F0FDF4' : C.surface,
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: C.surfaceAlt, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3"/>
        </svg>
      </div>
      <div style={{
        fontFamily: 'Spectral, Georgia, serif',
        fontSize: 18, fontWeight: 600,
        color: C.text, marginBottom: 6,
      }}>
        {loading ? 'Analyzing paper…' : 'Upload a research paper'}
      </div>
      <div style={{ fontSize: 13, color: C.textMuted, fontFamily: 'system-ui, sans-serif' }}>
        Drop a PDF here or click to browse · Max 20MB
      </div>
      <input ref={inputRef} type="file" accept=".pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  )
}

function PipelineStep({ label, desc, status }) {
  // status: 'done' | 'active' | 'pending'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${status === 'done' ? C.accent : status === 'active' ? C.accentMid : C.border}`,
        background: status === 'done' ? C.accent : status === 'active' ? C.accentLight : C.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        {status === 'done'
          ? <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>✓</span>
          : status === 'active'
          ? <Spinner />
          : <span style={{ color: C.border, fontSize: 11 }}>·</span>
        }
      </div>
      <div>
        <div style={{
          fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: 600,
          color: status === 'pending' ? C.textMuted : C.text,
        }}>{label}</div>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: 'system-ui, sans-serif', marginTop: 1 }}>
          {desc}
        </div>
      </div>
    </div>
  )
}

function AgentPipeline({ stage }) {
  const steps = [
    { id: 'extractor', label: 'Extracting claims', desc: 'Identifying every cited statement' },
    { id: 'resolver', label: 'Resolving citations', desc: 'Parsing reference metadata' },
    { id: 'fetcher', label: 'Retrieving papers', desc: 'Fetching cited sources' },
    { id: 'verifier', label: 'Verifying claims', desc: 'Checking semantic support' },
    { id: 'summarizer', label: 'Generating report', desc: 'Synthesizing integrity score' },
  ]
  const activeIdx = steps.findIndex(s => s.id === stage)

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '24px 28px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: 1,
        color: C.textMuted, fontFamily: 'system-ui, sans-serif',
        textTransform: 'uppercase', marginBottom: 20,
      }}>Analysis pipeline</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {steps.map((s, i) => (
          <PipelineStep
            key={s.id} label={s.label} desc={s.desc}
            status={i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending'}
          />
        ))}
      </div>
    </div>
  )
}

function IntegrityScore({ score, label }) {
  if (score == null) return null
  const colors = scoreColor(score)
  const r = 36, circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="48" cy="48" r={r} fill="none" stroke={C.border} strokeWidth="6" />
          <circle cx="48" cy="48" r={r} fill="none"
            stroke={colors.text} strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'Spectral, Georgia, serif',
            fontSize: 22, fontWeight: 700, color: colors.text, lineHeight: 1,
          }}>{score}</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif', marginBottom: 6 }}>
          Integrity score
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '4px 10px', borderRadius: 20,
          background: colors.bg, border: `1px solid ${colors.border}`,
          fontSize: 12, fontWeight: 600, color: colors.text,
          fontFamily: 'system-ui, sans-serif',
        }}>
          {label}
        </div>
      </div>
    </div>
  )
}

function SummaryBar({ summary, report }) {
  const stats = [
    { key: 'supported', label: 'Supported', dot: '#16A34A' },
    { key: 'partially_supported', label: 'Partial', dot: '#D97706' },
    { key: 'unsupported', label: 'Unsupported', dot: '#DC2626' },
    { key: 'cannot_determine', label: 'Unverified', dot: '#9CA3AF' },
    { key: 'retracted', label: 'Retracted', dot: '#EA580C' },
  ]

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, overflow: 'hidden', marginBottom: 20,
    }}>
      {/* Top section */}
      <div style={{ padding: '28px 32px', display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
        {report?.integrity_score != null && (
          <IntegrityScore score={report.integrity_score} label={report.verdict_label} />
        )}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{
            fontFamily: 'Spectral, Georgia, serif',
            fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4,
          }}>
            {summary.total} claims analyzed
          </div>
          {report?.summary && (
            <p style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 14, color: C.textMid, lineHeight: 1.6,
              margin: '8px 0 16px',
            }}>
              {report.summary}
            </p>
          )}

          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 12, gap: 1 }}>
            {stats.map(s => {
              const pct = summary.total ? (summary[s.key] / summary.total) * 100 : 0
              return pct > 0 ? (
                <div key={s.key} style={{ flex: pct, background: s.dot, transition: 'flex 0.8s ease' }} />
              ) : null
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
            {stats.map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.textMuted }}>
                  {s.label}: <strong style={{ color: C.text, fontWeight: 600 }}>{summary[s.key]}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key concerns */}
      {report?.key_concerns?.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '20px 32px', background: C.surfaceAlt }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.textMuted, textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif', marginBottom: 12 }}>
            Key concerns
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.key_concerns.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: C.orange, fontSize: 13, marginTop: 1, flexShrink: 0 }}>⚠</span>
                <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {report?.recommendation && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 32px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: C.accent, fontSize: 13, marginTop: 1, flexShrink: 0 }}>→</span>
          <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>
            <strong style={{ color: C.text, fontWeight: 600 }}>Recommendation: </strong>
            {report.recommendation}
          </span>
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
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${result.is_retracted ? '#EA580C' : vc.dot}`,
      borderRadius: 8,
      overflow: 'hidden',
      transition: 'box-shadow 0.15s ease',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start' }}
      >
        {/* Number */}
        <div style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 11, color: C.textMuted, minWidth: 22,
          paddingTop: 3, fontVariantNumeric: 'tabular-nums',
        }}>
          {String(index + 1).padStart(2, '0')}
        </div>

        {/* Claim text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14, color: C.text, lineHeight: 1.6, margin: '0 0 6px',
            display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {result.claim}
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              background: C.surfaceAlt, color: C.textMid,
              padding: '2px 6px', borderRadius: 4,
              border: `1px solid ${C.border}`,
            }}>
              [{result.citation_key}]
            </code>
            {result.resolved_title && (
              <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: C.textMuted }}>
                {result.resolved_title.slice(0, 55)}{result.resolved_title.length > 55 ? '…' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          {result.is_retracted && (
            <span style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 600,
              padding: '3px 8px', borderRadius: 4,
              background: C.orangeBg, color: C.orange,
              border: `1px solid ${C.orangeBorder}`,
            }}>RETRACTED</span>
          )}
          <span style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 500,
            padding: '3px 10px', borderRadius: 20,
            background: vc.bg, color: vc.color,
            border: `1px solid ${vc.border}`,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 10 }}>{vc.icon}</span> {vc.label}
          </span>
          <span style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 11,
            color: C.textMuted, transition: 'transform 0.15s',
            transform: expanded ? 'rotate(180deg)' : 'none',
            display: 'inline-block',
          }}>▾</span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          background: C.surfaceAlt,
          padding: '16px 18px 18px 54px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Confidence */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Confidence</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: vc.color, fontWeight: 600 }}>{result.confidence}%</span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${result.confidence}%`, background: vc.dot, borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* Explanation */}
          <div>
            <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>
              Explanation
            </div>
            <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: C.textMid, lineHeight: 1.6, margin: 0 }}>
              {result.explanation}
            </p>
          </div>

          {/* Excerpt */}
          {result.excerpt && (
            <div>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>
                From cited paper
              </div>
              <blockquote style={{
                fontFamily: 'Spectral, Georgia, serif',
                fontSize: 13, fontStyle: 'italic',
                color: C.textMid, lineHeight: 1.7,
                borderLeft: `2px solid ${C.borderStrong}`,
                paddingLeft: 12, margin: 0,
              }}>
                {result.excerpt}
              </blockquote>
            </div>
          )}

          {/* Retraction */}
          {result.is_retracted && (
            <div style={{
              padding: '10px 14px', borderRadius: 6,
              background: C.orangeBg, border: `1px solid ${C.orangeBorder}`,
            }}>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 700, color: C.orange, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                ⚠ Retraction notice
              </div>
              {result.retraction_date && (
                <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: C.textMid, margin: '0 0 2px' }}>
                  Retracted: {result.retraction_date}
                </p>
              )}
              {result.retraction_reason && (
                <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: C.textMuted, margin: 0 }}>
                  {result.retraction_reason}
                </p>
              )}
            </div>
          )}

          {/* Source */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: 11, color: C.textMuted }}>Retrieved via</span>
            <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: C.textMid }}>{result.fetch_status}</code>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultsDashboard({ data }) {
  const [filter, setFilter] = useState('all')

  const filters = [
    { key: 'all', label: 'All claims', count: data.results.length },
    { key: 'unsupported', label: 'Unsupported', count: data.summary.unsupported },
    { key: 'partially_supported', label: 'Partial', count: data.summary.partially_supported },
    { key: 'supported', label: 'Supported', count: data.summary.supported },
    { key: 'retracted', label: 'Retracted', count: data.summary.retracted },
    { key: 'cannot_determine', label: 'Unverified', count: data.summary.cannot_determine },
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 500,
            padding: '5px 12px', borderRadius: 6,
            border: `1px solid ${filter === f.key ? C.accent : C.border}`,
            background: filter === f.key ? C.accent : C.surface,
            color: filter === f.key ? 'white' : C.textMid,
            cursor: 'pointer', transition: 'all 0.12s ease',
          }}>
            {f.label}
            <span style={{ marginLeft: 5, opacity: 0.7, fontWeight: 400 }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Claims */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0
          ? <div style={{ fontFamily: 'system-ui, sans-serif', color: C.textMuted, textAlign: 'center', padding: 40, fontSize: 14 }}>
              No claims match this filter.
            </div>
          : filtered.map((r, i) => (
              <ClaimCard key={i} result={r} index={data.results.indexOf(r)} />
            ))
        }
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState('idle')
  const [pipelineStage, setPipelineStage] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filename, setFilename] = useState(null)

  const handleUpload = async (file) => {
    setFilename(file.name)
    setState('loading')
    setData(null)
    setError(null)

    const stages = ['extractor', 'resolver', 'fetcher', 'verifier', 'summarizer']
    let si = 0
    setPipelineStage(stages[0])
    const timer = setInterval(() => {
      si = Math.min(si + 1, stages.length - 1)
      setPipelineStage(stages[si])
    }, 5000)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/analyze', { method: 'POST', body: formData })
      clearInterval(timer)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      setData(await res.json())
      setState('done')
    } catch (err) {
      clearInterval(timer)
      setError(err.message)
      setState('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        body { background: ${C.bg}; }
        button { outline: none; font-family: inherit; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.borderStrong}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '0 32px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Logo />
        <div style={{ display: 'flex', gap: 6 }}>
          {['Extractor', 'Resolver', 'Retraction', 'Verifier', 'Summarizer'].map(a => (
            <div key={a} style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 500,
              padding: '3px 8px', borderRadius: 4,
              background: C.surfaceAlt, border: `1px solid ${C.border}`,
              color: C.textMuted,
            }}>{a}</div>
          ))}
        </div>
        <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: C.textMuted }}>
          Citation Integrity Verifier
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>

        {/* Hero */}
        {state === 'idle' && (
          <div style={{ marginBottom: 40, animation: 'fadeUp 0.4s ease' }}>
            <div style={{
              display: 'inline-block',
              fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 600,
              letterSpacing: 1.5, textTransform: 'uppercase',
              color: C.accentMid, marginBottom: 16,
            }}>
              Academic integrity tool
            </div>
            <h1 style={{
              fontFamily: 'Spectral, Georgia, serif',
              fontWeight: 700, fontSize: 'clamp(28px, 4vw, 44px)',
              lineHeight: 1.15, color: C.text,
              letterSpacing: '-0.5px', marginBottom: 16,
            }}>
              Does this paper actually say<br />what they claim it does?
            </h1>
            <p style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 16, color: C.textMid,
              lineHeight: 1.7, maxWidth: 520, marginBottom: 28,
            }}>
              CiteClaim verifies every citation in a research paper — checking whether cited sources genuinely support the claims made about them.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 40 }}>
              {[
                '🔍 Claim extraction',
                '🧩 Citation resolution',
                '🚫 Retraction detection',
                '⚖️ Semantic verification',
                '📊 Integrity scoring',
              ].map(f => (
                <div key={f} style={{
                  fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 500,
                  padding: '5px 12px', borderRadius: 20,
                  border: `1px solid ${C.border}`,
                  background: C.surface, color: C.textMid,
                }}>{f}</div>
              ))}
            </div>
          </div>
        )}

        {/* Upload */}
        {(state === 'idle' || state === 'done' || state === 'error') && (
          <div style={{ marginBottom: state === 'done' ? 40 : 0 }}>
            <UploadZone onUpload={handleUpload} loading={false} />
          </div>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <div style={{ animation: 'fadeUp 0.3s ease' }}>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            }}>
              <Spinner />
              <div>
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: 600, color: C.text }}>
                  Analyzing {filename}
                </div>
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  This takes 1–3 minutes depending on citation count
                </div>
              </div>
            </div>
            <AgentPipeline stage={pipelineStage} />
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div style={{
            marginTop: 20, padding: '14px 18px',
            background: C.redBg, border: `1px solid ${C.redBorder}`,
            borderRadius: 8, animation: 'fadeUp 0.3s ease',
          }}>
            <div style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600, color: C.red, fontSize: 14, marginBottom: 4 }}>
              Analysis failed
            </div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: C.textMid }}>{error}</div>
          </div>
        )}

        {/* Results */}
        {state === 'done' && data && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
              <div>
                <h2 style={{
                  fontFamily: 'Spectral, Georgia, serif',
                  fontWeight: 700, fontSize: 24, color: C.text,
                }}>Results</h2>
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                  {filename}
                </div>
              </div>
              <button onClick={() => setState('idle')} style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 500,
                color: C.textMid, background: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '7px 14px', cursor: 'pointer',
              }}>
                ← Analyze another paper
              </button>
            </div>
            <ResultsDashboard data={data} />
          </div>
        )}
      </main>
    </div>
  )
}
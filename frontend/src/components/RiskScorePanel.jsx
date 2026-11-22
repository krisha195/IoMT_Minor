import { useEffect, useState } from 'react'
import api from '../api'

const LEVEL_COLORS = {
  normal:   { color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', label: 'Normal / Stable',   emoji: '✅' },
  mild:     { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Mild Risk',         emoji: '⚠️' },
  moderate: { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'Moderate Risk',     emoji: '🔶' },
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Critical Risk',     emoji: '🚨' },
  unknown:  { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Pending Readings',  emoji: '❓' },
}

function GaugeArc({ score, color }) {
  const r = 54
  const cx = 70, cy = 70
  const total = Math.PI * r          // half circle arc length
  const filled = (score / 100) * total
  const dash = `${filled} ${total}`
  return (
    <svg width={140} height={80} style={{ overflow: 'visible' }}>
      {/* background arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#e2e8f0" strokeWidth={12} strokeLinecap="round" />
      {/* filled arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
        strokeDasharray={dash} strokeDashoffset={0}
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      {/* score text */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize={26} fontWeight={800}>{score}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize={11} fontWeight={600}>/100</text>
    </svg>
  )
}

export default function RiskScorePanel({ patientId }) {
  const [risk, setRisk] = useState(null)

  useEffect(() => {
    const fetch = () => api.get(`/api/risk/${patientId}`).then(r => setRisk(r.data)).catch(() => {})
    fetch()
    const interval = setInterval(fetch, 5000)
    return () => clearInterval(interval)
  }, [patientId])

  if (!risk) return null

  const c = LEVEL_COLORS[risk.level] || LEVEL_COLORS.unknown

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: '22px 24px',
      marginBottom: 20,
      boxShadow: 'var(--shadow-sm)'
    }}>

      {/* Header */}
      <div style={{
        color: 'var(--text-primary)',
        fontSize: 14,
        fontWeight: 700,
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        letterSpacing: '-0.01em'
      }}>
        <span>🧠</span> Explainable AI Clinical Health Risk Score
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {risk.score !== null
            ? <GaugeArc score={risk.score} color={c.color} />
            : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data</div>
          }
          <span style={{
            background: c.bg, border: `1px solid ${c.border}`,
            color: c.color, fontSize: 11.5, fontWeight: 700,
            padding: '3px 12px', borderRadius: 'var(--radius-full)'
          }}>{c.emoji} {c.label}</span>
        </div>

        {/* Contributions */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{
            color: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 12
          }}>
            Physiological Biomarker Weights
          </div>
          {risk.contributions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>All vital parameters within normal baseline.</div>
          ) : (
            risk.contributions.map(ct => {
              const barColor = ct.score === 0 ? '#10b981' : ct.score <= 30 ? '#f59e0b' : ct.score <= 60 ? '#f97316' : '#ef4444'
              return (
                <div key={ct.vital} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
                      {ct.vital}
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>
                        ({ct.value}{ct.unit})
                      </span>
                    </span>
                    <span style={{ color: barColor, fontSize: 12, fontWeight: 700 }}>
                      {ct.weight}% impact
                    </span>
                  </div>
                  {/* Bar */}
                  <div style={{ height: 6, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${ct.weight}%`,
                      background: barColor, borderRadius: 4,
                      transition: 'width 0.8s ease'
                    }} />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rolling Baselines and Thresholds */}
        <div style={{
          flexBasis: '100%',
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px'
        }}>
          <div style={{
            color: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 10
          }}>
            Personal Baselines (Last 60 Readings)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            {risk.baselines && Object.entries(risk.baselines).map(([name, baseline]) => (
              <div key={name} style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: '9px 11px', background: '#fff' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>{name}</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 800, marginTop: 3 }}>
                  {baseline.mean} {baseline.unit}
                  {baseline.std !== undefined && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}> ± {baseline.std}</span>
                  )}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 3 }}>
                  based on {baseline.samples} readings
                </div>
              </div>
            ))}
          </div>
          {risk.thresholds && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {Object.entries(risk.thresholds).filter(([name]) => name !== 'clinical_limits').map(([name, values]) => (
                <div key={name} style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5 }}>
                  <strong>{name}:</strong>{' '}
                  {typeof values === 'object'
                    ? Object.entries(values).map(([label, value]) => `${label} ${value}`).join(' | ')
                    : values}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Explanation */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          minWidth: 220,
          maxWidth: 290
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Clinical Rationale
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.55 }}>
            {risk.explanation}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {risk.vitals && [
              ['❤️ Heart Rate', risk.vitals.hr, 'bpm'],
              ['🫁 SpO₂ Oxygen', risk.vitals.spo2, '%'],
              ['🌡️ Body Temp', risk.vitals.temperature, '°C'],
              ['🏃 Motion', risk.motion_status || 'STABLE', ''],
            ].map(([label, val, unit]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{val} {unit}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

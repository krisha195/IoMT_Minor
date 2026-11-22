import { useEffect, useState } from 'react'
import api from '../api'

const SEV_STYLE = {
  urgent:  { badge: '#dc2626', bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '🚨' },
  warning: { badge: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '⚠️' },
  normal:  { badge: '#059669', bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: '✓' }
}

export default function AIVitalSuggestions({ patientId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchSuggestions = () => {
    api.get(`/api/vitals/${patientId}/ai-suggestions`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSuggestions()
    const interval = setInterval(fetchSuggestions, 4000)
    return () => clearInterval(interval)
  }, [patientId])

  if (loading && !data) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 18, marginBottom: 20 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading AI clinical vital suggestions...</div>
      </div>
    )
  }

  const suggestions = data?.suggestions || []

  return (
    <div style={{
      background: '#ffffff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
      padding: '22px 24px', marginBottom: 22, boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
            border: '1px solid var(--primary-border)'
          }}>🤖</div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              AI Clinical Vital Suggestions & Trend Analysis
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Real-time physiological trend monitoring across connected IoMT readings
            </div>
          </div>
        </div>

        {data?.overall_status && (
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
            padding: '4px 11px', borderRadius: 'var(--radius-full)',
            background: data.overall_status === 'urgent_review_required' ? 'var(--danger-bg)' : data.overall_status === 'caution' ? 'var(--warning-bg)' : 'var(--success-bg)',
            color: data.overall_status === 'urgent_review_required' ? 'var(--danger-text)' : data.overall_status === 'caution' ? 'var(--warning-text)' : 'var(--success-text)',
            border: `1px solid ${data.overall_status === 'urgent_review_required' ? 'var(--danger-border)' : data.overall_status === 'caution' ? 'var(--warning-border)' : 'var(--success-border)'}`
          }}>
            Status: {data.overall_status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Suggestions List */}
      {suggestions.length === 0 ? (
        <div style={{ padding: '16px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', fontSize: 13 }}>
          Waiting for vital stream to generate clinical trend suggestions.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {suggestions.map((s, idx) => {
            const st = SEV_STYLE[s.severity] || SEV_STYLE.normal
            return (
              <div key={idx} style={{
                background: 'var(--bg-canvas)', border: `1px solid ${st.border}`,
                borderLeft: `4px solid ${st.badge}`,
                borderRadius: 'var(--radius-md)', padding: '14px 16px', transition: 'all 0.15s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15 }}>{st.icon}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13.5 }}>{s.vital}</span>
                    <span style={{ background: '#ffffff', border: '1px solid var(--border-default)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                      {s.measured_value}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                    padding: '2px 8px', borderRadius: 'var(--radius-full)', background: st.bg, color: st.text, border: `1px solid ${st.border}`
                  }}>
                    {s.severity}
                  </span>
                </div>

                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Reason: </strong>{s.reason}
                </div>

                <div style={{
                  fontSize: 12.5, color: 'var(--primary)', background: 'var(--primary-light)',
                  border: '1px solid var(--primary-border)', padding: '8px 12px', borderRadius: 'var(--radius-sm)'
                }}>
                  <strong>Recommended Next Step: </strong>{s.recommended_action}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Clinical Disclaimer */}
      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-default)', paddingTop: 10 }}>
        ℹ️ Clinical Disclaimer: AI suggestions support clinical decision-making. They do not independently diagnose conditions, prescribe medicines, change dosages, or replace emergency medical care.
      </div>
    </div>
  )
}


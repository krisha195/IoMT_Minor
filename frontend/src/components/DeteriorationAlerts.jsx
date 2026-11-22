import { useEffect, useState } from 'react'
import api from '../api'

const RISK_BADGES = {
  critical: { bg: 'var(--danger-light)', text: 'var(--danger)', border: '#fca5a5', emoji: '🚨', label: 'Critical Risk' },
  warning:  { bg: 'var(--warning-light)', text: 'var(--warning)', border: '#fed7aa', emoji: '⚠️', label: 'Moderate Risk' },
  low:      { bg: 'var(--success-light)', text: 'var(--success)', border: '#bbf7d0', emoji: '✓', label: 'Stable Recovery' }
}

export default function DeteriorationAlerts({ patientId, isDoctor = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [reviewedSuccess, setReviewedSuccess] = useState(false)

  const fetchDeterioration = () => {
    api.get(`/api/recovery/${patientId}/deterioration`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDeterioration()
    const interval = setInterval(fetchDeterioration, 6000)
    return () => clearInterval(interval)
  }, [patientId])

  const submitReview = async (e) => {
    e.preventDefault()
    if (!reviewNote.trim()) return
    setReviewing(true)
    try {
      await api.post(`/api/recovery/${patientId}/deterioration/review`, {
        notes: reviewNote,
        action_taken: 'Physician reviewed telemetry & ordered continuing protocol'
      })
      setReviewedSuccess(true)
      setReviewNote('')
      setTimeout(() => setReviewedSuccess(false), 4000)
      fetchDeterioration()
    } catch {
      alert('Failed to log review')
    } finally {
      setReviewing(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="saas-card" style={{ padding: 18, marginBottom: 22 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Evaluating recovery deterioration signals...</div>
      </div>
    )
  }

  const badge = RISK_BADGES[data?.deterioration_level] || RISK_BADGES.low
  const signals = data?.signals_detected || []

  return (
    <div className="saas-card" style={{ padding: 22, marginBottom: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: badge.bg, border: `1px solid ${badge.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {badge.emoji}
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Early Recovery Deterioration Detection
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '2px 0 0 0' }}>
              Multi-signal trend analysis tracking vital drift from post-treatment baseline
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontSize: 20, fontWeight: 800, color: badge.text,
            background: badge.bg, border: `1px solid ${badge.border}`,
            padding: '5px 14px', borderRadius: 8, display: 'flex', alignItems: 'baseline', gap: 4
          }}>
            <span>{data?.risk_score ?? 0}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>/100</span>
          </div>
        </div>
      </div>

      {/* Escalation Recommendation */}
      <div style={{
        background: 'var(--bg-canvas)', border: '1px solid var(--border-default)',
        borderLeft: `4px solid ${badge.text}`,
        borderRadius: 8, padding: '12px 16px', marginBottom: 18
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: badge.text, marginBottom: 4 }}>
          Clinical Escalation Guidance
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
          {data?.recommended_escalation}
        </div>
      </div>

      {/* Detected Signals */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
          Correlated Recovery Indicators ({signals.length})
        </div>
        {signals.length === 0 ? (
          <div style={{ padding: 14, background: 'var(--success-light)', border: '1px solid #bbf7d0', borderRadius: 8, color: 'var(--success)', fontSize: 12, fontWeight: 500 }}>
            ✓ All parameters remain within established post-operative tolerance limits.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {signals.map((s, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: 8,
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 8
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{s.signal}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{s.details}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '2px 8px', borderRadius: 6 }}>
                  ⏱️ {s.timeframe}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Doctor Action Panel */}
      {isDoctor && (
        <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 14 }}>
          {reviewedSuccess && (
            <div style={{ color: 'var(--success)', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
              ✓ Clinical review logged in patient recovery record.
            </div>
          )}
          <form onSubmit={submitReview} style={{ display: 'flex', gap: 10 }}>
            <input
              placeholder="Document physician clinical evaluation & follow-up action..."
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              disabled={reviewing}
              className="saas-input"
              style={{ flex: 1, fontSize: 12 }}
            />
            <button
              type="submit"
              disabled={reviewing || !reviewNote.trim()}
              className="saas-btn saas-btn-primary"
              style={{ padding: '8px 16px', fontSize: 12, background: '#16a34a' }}
            >
              {reviewing ? 'Saving...' : 'Log Review'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}



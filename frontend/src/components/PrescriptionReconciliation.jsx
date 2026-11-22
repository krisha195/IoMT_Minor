import { useEffect, useState } from 'react'
import api from '../api'

export default function PrescriptionReconciliation({ patientId, isDoctor = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState(null)
  const [notes, setNotes] = useState('')

  const fetchReconciliation = () => {
    api.get(`/api/recovery/${patientId}/reconciliation`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReconciliation()
  }, [patientId])

  const resolveItem = async (e) => {
    e.preventDefault()
    if (!resolvingId) return
    try {
      await api.post(`/api/recovery/reconciliation/${resolvingId}/resolve`, { resolution_notes: notes })
      setResolvingId(null)
      setNotes('')
      fetchReconciliation()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to resolve item')
    }
  }

  const flags = data?.reconciliation_flags || []

  return (
    <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 18, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h4 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, margin: 0 }}>
            Prescription Conflict & Reconciliation Analysis
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: '2px 0 0 0' }}>
            Cross-verifying pre-admission records, discharge orders, and active medications
          </p>
        </div>
        <button onClick={fetchReconciliation} className="saas-btn saas-btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>
          🔄 Re-Analyze
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 10 }}>Running reconciliation check...</div>
      ) : flags.length === 0 ? (
        <div style={{ padding: 14, background: 'var(--success-light)', border: '1px solid #bbf7d0', borderRadius: 8, color: 'var(--success)', fontSize: 12, fontWeight: 500 }}>
          ✓ No medication discrepancies or conflicts detected between pre-hospital and discharge prescriptions.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flags.map((item, idx) => {
            const isResolved = item.status === 'resolved'
            const isCritical = item.severity === 'critical'

            return (
              <div key={item.id || idx} style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${isResolved ? 'var(--border-default)' : isCritical ? '#fca5a5' : '#fed7aa'}`,
                borderLeft: `4px solid ${isResolved ? 'var(--success)' : isCritical ? 'var(--danger)' : 'var(--warning)'}`,
                borderRadius: 8, padding: '12px 14px',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{isResolved ? '✅' : isCritical ? '🚨' : '⚠️'}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{item.medication_name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4,
                      background: isResolved ? 'var(--success-light)' : isCritical ? 'var(--danger-light)' : 'var(--warning-light)',
                      color: isResolved ? 'var(--success)' : isCritical ? 'var(--danger)' : 'var(--warning)',
                      border: `1px solid ${isResolved ? '#bbf7d0' : isCritical ? '#fecaca' : '#fde68a'}`
                    }}>
                      {item.conflict_type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: isResolved ? 'var(--success)' : isCritical ? 'var(--danger)' : 'var(--warning)'
                  }}>
                    {isResolved ? 'Resolved by Physician' : 'Pending Clinical Verification'}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.45 }}>
                  {item.description}
                </div>

                <div style={{ fontSize: 11.5, color: '#1e40af', background: 'var(--primary-light)', border: '1px solid #bfdbfe', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>
                  <strong>Recommendation:</strong> {item.recommendation}
                </div>

                {item.resolution_notes && (
                  <div style={{ fontSize: 11, color: 'var(--success)', background: 'var(--success-light)', border: '1px solid #bbf7d0', padding: '5px 8px', borderRadius: 4 }}>
                    <strong>Doctor Notes:</strong> {item.resolution_notes}
                  </div>
                )}

                {isDoctor && !isResolved && item.id && (
                  <div style={{ marginTop: 8 }}>
                    {resolvingId === item.id ? (
                      <form onSubmit={resolveItem} style={{ display: 'flex', gap: 8 }}>
                        <input
                          required
                          placeholder="Document clinical reconciliation rationale..."
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          className="saas-input"
                          style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                        />
                        <button type="submit" className="saas-btn saas-btn-primary" style={{ padding: '6px 12px', fontSize: 12, background: '#16a34a' }}>
                          Save
                        </button>
                        <button type="button" onClick={() => setResolvingId(null)} className="saas-btn saas-btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }}>
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button onClick={() => { setResolvingId(item.id); setNotes('') }} className="saas-btn saas-btn-secondary" style={{
                        padding: '4px 10px', fontSize: 11, color: 'var(--primary)', borderColor: 'var(--border-default)'
                      }}>
                        Review & Resolve Discrepancy
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}



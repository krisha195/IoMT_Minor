import { useEffect, useState } from 'react'
import api from '../api'

const MILESTONE_COLORS = {
  completed:   { bg: 'var(--success-light)', text: 'var(--success)', border: '#bbf7d0', label: 'Completed' },
  in_progress: { bg: 'var(--warning-light)', text: 'var(--warning)', border: '#fed7aa', label: 'In Progress' },
  pending:     { bg: 'var(--bg-canvas)', text: 'var(--text-secondary)', border: 'var(--border-default)', label: 'Pending' }
}

export default function SurgeryHistory({ patientId, isDoctor = false }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = () => {
    api.get(`/api/recovery/${patientId}/history`)
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchHistory()
  }, [patientId])

  const toggleMilestone = async (historyId, index, curStatus) => {
    if (!isDoctor) return
    const nextStatus = curStatus === 'completed' ? 'in_progress' : 'completed'
    try {
      await api.put(`/api/recovery/history/${historyId}/milestone`, {
        milestone_index: index,
        status: nextStatus
      })
      fetchHistory()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update milestone')
    }
  }

  return (
    <div className="saas-card" style={{ padding: 22, marginBottom: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          📜
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Patient Surgery & Major Treatment History
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '2px 0 0 0' }}>
            Verified chronological surgical procedures, hospitalizations, recovery milestones, and post-op instructions
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 12 }}>Loading medical history...</div>
      ) : history.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, background: 'var(--bg-canvas)', borderRadius: 10, border: '1px dashed var(--border-default)' }}>
          No surgical or major treatment records documented for this patient.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {history.map(record => {
            const milestones = record.recovery_milestones || []
            const followups = record.followup_appointments || []

            return (
              <div key={record.id} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 20,
                boxShadow: 'var(--shadow-xs)'
              }}>
                {/* Title & Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', margin: '0 0 4px 0' }}>
                      {record.procedure_name}
                    </h4>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Indication:</strong> {record.indication}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Date: {record.procedure_date}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {record.hospital_name || 'Hospital record'}
                    </div>
                  </div>
                </div>

                {/* Admission & Discharge Dates */}
                {(record.admission_date || record.discharge_date) && (
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12, background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', padding: '8px 12px', borderRadius: 8 }}>
                    {record.admission_date && <span>🏥 <strong style={{ color: 'var(--text-primary)' }}>Admission:</strong> {record.admission_date}</span>}
                    {record.discharge_date && <span>🏠 <strong style={{ color: 'var(--text-primary)' }}>Discharge:</strong> {record.discharge_date}</span>}
                  </div>
                )}

                {/* Discharge Summary */}
                {record.discharge_summary && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Discharge Summary
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, background: 'var(--bg-canvas)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                      {record.discharge_summary}
                    </div>
                  </div>
                )}

                {/* Doctor Instructions */}
                {record.doctor_instructions && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 4 }}>
                      Prescribed Home Recovery Instructions
                    </div>
                    <div style={{ fontSize: 12.5, color: '#1e40af', lineHeight: 1.55, background: 'var(--primary-light)', padding: '10px 14px', borderRadius: 8, borderLeft: '4px solid var(--primary)', border: '1px solid #bfdbfe' }}>
                      {record.doctor_instructions}
                    </div>
                  </div>
                )}

                {/* Medication changes */}
                {record.medication_changes && (
                  <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--warning)', background: 'var(--warning-light)', padding: '8px 12px', borderRadius: 8, border: '1px solid #fed7aa' }}>
                    <strong>Regimen Adjustments:</strong> {record.medication_changes}
                  </div>
                )}

                {/* Recovery Milestones */}
                {milestones.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Recovery Milestones Tracker {isDoctor && <span style={{ fontSize: 11, color: 'var(--primary)', textTransform: 'none', fontWeight: 600 }}>(Click to update status)</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {milestones.map((m, idx) => {
                        const mStyle = MILESTONE_COLORS[m.status] || MILESTONE_COLORS.pending
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleMilestone(record.id, idx, m.status)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '9px 14px', background: 'var(--bg-canvas)', borderRadius: 8,
                              border: `1px solid ${mStyle.border}`,
                              cursor: isDoctor ? 'pointer' : 'default', transition: 'all 0.15s'
                            }}
                            onMouseOver={e => { if (isDoctor) e.currentTarget.style.borderColor = 'var(--primary)' }}
                            onMouseOut={e => { if (isDoctor) e.currentTarget.style.borderColor = mStyle.border }}
                          >
                            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                              Day {m.day}: {m.milestone}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                              padding: '2px 8px', borderRadius: 10, background: mStyle.bg, color: mStyle.text,
                              border: `1px solid ${mStyle.border}`
                            }}>
                              {mStyle.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Follow-up appointments */}
                {followups.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Follow-up Consultations
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {followups.map((f, idx) => (
                        <div key={idx} style={{
                          background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: 8,
                          padding: '10px 14px', fontSize: 12, flex: 1, minWidth: 200,
                          boxShadow: 'var(--shadow-xs)'
                        }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>📅 {f.date}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>{f.purpose}</div>
                          <div style={{ color: 'var(--text-light)', fontSize: 11, marginTop: 2 }}>{f.doctor} • {f.clinic}</div>
                        </div>
                      ))}
                    </div>
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



import { useEffect, useState } from 'react'
import api from '../api'

export default function RecoveryProgress({ patientId, isDoctor = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAssessModal, setShowAssessModal] = useState(false)
  const [assessment, setAssessment] = useState({
    clinical_notes: '', overall_status: 'on_track', plan_adjustments: ''
  })

  const fetchProgress = () => {
    api.get(`/api/recovery/${patientId}/progress`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchProgress()
  }, [patientId])

  const handleAssessmentSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/api/recovery/${patientId}/progress/assessment`, assessment)
      setShowAssessModal(false)
      setAssessment({ clinical_notes: '', overall_status: 'on_track', plan_adjustments: '' })
      fetchProgress()
    } catch {
      alert('Failed to save assessment')
    }
  }

  if (loading && !data) {
    return (
      <div className="saas-card" style={{ padding: 18, marginBottom: 22 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Calculating recovery progress metrics...</div>
      </div>
    )
  }

  const milestones = data?.milestones || []
  const assessments = data?.clinical_assessments || []

  return (
    <div className="saas-card" style={{ padding: 22, marginBottom: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📈</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Recovery Progress Verification & Milestone Tracker
            </h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '2px 0 0 0' }}>
            Comprehensive post-operative recovery index combining adherence, vital stability, and clinical evaluations
          </p>
        </div>

        {isDoctor && (
          <button onClick={() => setShowAssessModal(true)} className="saas-btn saas-btn-primary" style={{ padding: '7px 14px', fontSize: 12, background: '#16a34a' }}>
            + Document Clinical Assessment
          </button>
        )}
      </div>

      {/* Score Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '16px 18px', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Overall Recovery Index</div>
          <div style={{ color: 'var(--primary)', fontSize: 28, fontWeight: 800, marginTop: 4 }}>
            {data?.recovery_score ?? 0}<span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>%</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>Composite wellness metric</div>
        </div>

        <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '16px 18px', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Task Adherence</div>
          <div style={{ color: 'var(--success)', fontSize: 28, fontWeight: 800, marginTop: 4 }}>
            {data?.task_adherence_rate ?? 0}<span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>%</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>{data?.completed_tasks} of {data?.total_tasks} completed</div>
        </div>

        <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '16px 18px', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Medication Adherence</div>
          <div style={{ color: '#7c3aed', fontSize: 28, fontWeight: 800, marginTop: 4 }}>
            {data?.medication_adherence_rate ?? 0}<span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>%</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>Prescribed dose compliance</div>
        </div>

        <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '16px 18px', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Vital Stability</div>
          <div style={{ color: '#d97706', fontSize: 28, fontWeight: 800, marginTop: 4 }}>
            {data?.vital_stability_index ?? 0}<span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>%</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>Readings in baseline range</div>
        </div>
      </div>

      {/* Clinical Assessments History */}
      <div style={{ marginTop: 20 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Doctor's Clinical Recovery Assessments ({assessments.length})
        </h4>

        {assessments.length === 0 ? (
          <div style={{ padding: 18, background: 'var(--bg-canvas)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', border: '1px dashed var(--border-default)' }}>
            No clinical assessments recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {assessments.map(item => (
              <div key={item.id} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '14px 16px',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>👨‍⚕️ {item.doctor}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 10,
                      background: item.status === 'on_track' ? 'var(--success-light)' : 'var(--warning-light)',
                      color: item.status === 'on_track' ? 'var(--success)' : 'var(--warning)',
                      border: `1px solid ${item.status === 'on_track' ? '#bbf7d0' : '#fed7aa'}`
                    }}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                  </span>
                </div>

                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                  {item.notes}
                </div>

                {item.plan_adjustments && (
                  <div style={{ fontSize: 11.5, color: '#1e40af', background: 'var(--primary-light)', border: '1px solid #bfdbfe', padding: '6px 10px', borderRadius: 6 }}>
                    <strong>Plan Directives:</strong> {item.plan_adjustments}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assessment Modal */}
      {showAssessModal && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-content">
            <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Document Clinical Recovery Assessment</h3>
            <form onSubmit={handleAssessmentSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Overall Clinical Status</label>
                <select value={assessment.overall_status} onChange={e => setAssessment({ ...assessment, overall_status: e.target.value })}
                  className="saas-input">
                  <option value="on_track">On Track (Healing favorably)</option>
                  <option value="needs_attention">Needs Attention (Slight deviation)</option>
                  <option value="deteriorating">Deteriorating (Complication risk)</option>
                  <option value="recovered">Recovered (Criteria met)</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Clinical Progress Notes</label>
                <textarea rows={3} required placeholder="Wound healing, pain levels, mobilization progress..." value={assessment.clinical_notes}
                  onChange={e => setAssessment({ ...assessment, clinical_notes: e.target.value })}
                  className="saas-input" style={{ resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Recovery Plan Adjustments</label>
                <textarea rows={2} placeholder="Medication changes, activity restrictions, next review date..." value={assessment.plan_adjustments}
                  onChange={e => setAssessment({ ...assessment, plan_adjustments: e.target.value })}
                  className="saas-input" style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowAssessModal(false)} className="saas-btn saas-btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="saas-btn saas-btn-primary" style={{ background: '#16a34a' }}>
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}



import { useEffect, useState } from 'react'
import api from '../api'
import PrescriptionReconciliation from './PrescriptionReconciliation'

export default function MedicationTracker({ patientId, isDoctor = false, isCaregiver = false, careStatus = 'POST_TREATMENT_RECOVERY' }) {
  const [meds, setMeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active') // 'active', 'reconciliation', 'discontinued'
  const [showAddModal, setShowAddModal] = useState(false)
  const [doseLogging, setDoseLogging] = useState(null)
  const [newMed, setNewMed] = useState({
    name: '', dosage: '', frequency: 'Twice daily', scheduled_timings: '08:00 AM, 08:00 PM',
    instructions: '', source: 'discharge'
  })

  const isReadOnly = careStatus === 'RECOVERY_COMPLETED'

  const fetchMeds = () => {
    api.get(`/api/recovery/${patientId}/medications`)
      .then(r => setMeds(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMeds()
  }, [patientId])

  const logDose = async (medId) => {
    if (isReadOnly) return
    setDoseLogging(medId)
    try {
      await api.post(`/api/recovery/medications/${medId}/dose`)
      alert('Dose recorded successfully with timestamp and user verification.')
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to record dose')
    } finally {
      setDoseLogging(null)
    }
  }

  const updateStatus = async (medId, status) => {
    if (!window.confirm(`Are you sure you want to change this prescription status to ${status}?`)) return
    try {
      await api.put(`/api/recovery/medications/${medId}/status`, { status })
      fetchMeds()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update status')
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/api/recovery/${patientId}/medications`, newMed)
      setShowAddModal(false)
      setNewMed({ name: '', dosage: '', frequency: 'Twice daily', scheduled_timings: '08:00 AM, 08:00 PM', instructions: '', source: 'discharge' })
      fetchMeds()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add medication')
    }
  }

  const activeMeds = meds.filter(m => m.status === 'active')
  const discontinuedMeds = meds.filter(m => m.status !== 'active')

  return (
    <div className="saas-card" style={{ padding: 22, marginBottom: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💊</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Major Medication Tracking & Reconciliation
            </h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '4px 0 0 0' }}>
            Doctor-prescribed post-treatment regimen, dose logging, and safety reconciliation
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDoctor && !isReadOnly && (
            <button onClick={() => setShowAddModal(true)} className="saas-btn saas-btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}>
              + Add Prescription
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid var(--border-default)', paddingBottom: 10 }}>
        {[
          ['active', `Active Prescriptions (${activeMeds.length})`],
          ['reconciliation', '⚖️ Prescription Reconciliation'],
          ['discontinued', `Discontinued / Pre-Hospital (${discontinuedMeds.length})`]
        ].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            background: activeTab === key ? 'var(--primary-light)' : 'transparent',
            border: activeTab === key ? '1px solid #bfdbfe' : '1px solid transparent',
            borderRadius: 6, padding: '6px 14px',
            color: activeTab === key ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: 12, fontWeight: activeTab === key ? 600 : 500, cursor: 'pointer',
            transition: 'all 0.15s'
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Reconciliation Tab */}
      {activeTab === 'reconciliation' && (
        <PrescriptionReconciliation patientId={patientId} isDoctor={isDoctor} />
      )}

      {/* Active Medications */}
      {activeTab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 12 }}>Loading medication schedule...</div>
          ) : activeMeds.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, background: 'var(--bg-canvas)', borderRadius: 10, border: '1px dashed var(--border-default)' }}>
              No active recovery prescriptions found.
            </div>
          ) : (
            activeMeds.map(med => (
              <div key={med.id} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10,
                padding: '16px 18px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 12,
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{med.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                      {med.dosage}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: 'var(--success-light)', color: 'var(--success)', padding: '2px 8px', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                      Active
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Frequency:</strong> {med.frequency} &nbsp;|&nbsp; <strong style={{ color: 'var(--text-primary)' }}>Timings:</strong> {med.scheduled_timings || 'Standard'}
                  </div>

                  {med.instructions && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Instructions:</strong> {med.instructions}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!isReadOnly && (
                    <button
                      disabled={doseLogging === med.id}
                      onClick={() => logDose(med.id)}
                      style={{
                        padding: '8px 14px', background: '#16a34a',
                        border: 'none', borderRadius: 8, color: 'white', fontWeight: 600,
                        fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#15803d'}
                      onMouseOut={e => e.currentTarget.style.background = '#16a34a'}
                    >
                      {doseLogging === med.id ? 'Recording...' : '✓ Confirm Dose Taken'}
                    </button>
                  )}

                  {isDoctor && !isReadOnly && (
                    <button
                      onClick={() => updateStatus(med.id, 'discontinued')}
                      style={{
                        padding: '7px 12px', background: 'transparent',
                        border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--danger)',
                        fontSize: 12, cursor: 'pointer', transition: 'all 0.15s'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--danger-light)'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                      title="Discontinue medication"
                    >
                      Discontinue
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Discontinued Medications */}
      {activeTab === 'discontinued' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {discontinuedMeds.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, background: 'var(--bg-canvas)', borderRadius: 10, border: '1px dashed var(--border-default)' }}>
              No discontinued or pre-hospital medications logged.
            </div>
          ) : (
            discontinuedMeds.map(med => (
              <div key={med.id} style={{
                background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: 10,
                padding: '14px 16px', opacity: 0.85
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{med.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>({med.dosage})</span>
                  <span style={{ fontSize: 10, background: 'var(--danger-light)', color: 'var(--danger)', padding: '1px 6px', borderRadius: 6, border: '1px solid #fecaca' }}>
                    {med.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', padding: '1px 6px', borderRadius: 6 }}>
                    Source: {med.source}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {med.instructions || 'Withheld during acute recovery period.'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-content">
            <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Prescribe Medication</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Medication Name</label>
                <input required placeholder="e.g. Amoxicillin / Clavulanate" value={newMed.name}
                  onChange={e => setNewMed({ ...newMed, name: e.target.value })}
                  className="saas-input" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Dosage</label>
                  <input required placeholder="e.g. 500 mg" value={newMed.dosage}
                    onChange={e => setNewMed({ ...newMed, dosage: e.target.value })}
                    className="saas-input" />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Frequency</label>
                  <input required placeholder="e.g. Twice daily" value={newMed.frequency}
                    onChange={e => setNewMed({ ...newMed, frequency: e.target.value })}
                    className="saas-input" />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Scheduled Timings</label>
                <input placeholder="e.g. 08:00 AM, 08:00 PM" value={newMed.scheduled_timings}
                  onChange={e => setNewMed({ ...newMed, scheduled_timings: e.target.value })}
                  className="saas-input" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Instructions</label>
                <textarea rows={2} placeholder="Take with food, complete full course..." value={newMed.instructions}
                  onChange={e => setNewMed({ ...newMed, instructions: e.target.value })}
                  className="saas-input" style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="saas-btn saas-btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="saas-btn saas-btn-primary">
                  Prescribe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}



import { useEffect, useState } from 'react'
import api from '../api'

export default function CaregiverCoordination({ patientId, isDoctor = false }) {
  const [caregivers, setCaregivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newCg, setNewCg] = useState({
    caregiver_username: '', relationship: 'Family Member', phone: ''
  })

  const fetchCaregivers = () => {
    api.get(`/api/recovery/${patientId}/caregivers`)
      .then(r => setCaregivers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchCaregivers()
  }, [patientId])

  const handleLink = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/api/recovery/${patientId}/caregivers`, newCg)
      setShowModal(false)
      setNewCg({ caregiver_username: '', relationship: 'Family Member', phone: '' })
      fetchCaregivers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to link caregiver')
    }
  }

  return (
    <div className="saas-card" style={{ padding: 22, marginBottom: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🤝</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Shared Family Care Coordination
            </h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '2px 0 0 0' }}>
            Authorized family members & caregivers coordinating home recovery and task completion
          </p>
        </div>

        {isDoctor && (
          <button onClick={() => setShowModal(true)} className="saas-btn saas-btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}>
            + Link Family Caregiver
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 12 }}>Loading caregivers...</div>
      ) : caregivers.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, background: 'var(--bg-canvas)', borderRadius: 10, border: '1px dashed var(--border-default)' }}>
          No family caregivers linked yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {caregivers.map(cg => (
            <div key={cg.id} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '16px 18px',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'white',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                }}>
                  {cg.caregiver_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{cg.caregiver_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>{cg.relationship}</div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Username:</strong> @{cg.caregiver_username}
              </div>
              {cg.phone && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Phone:</strong> {cg.phone}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, background: 'var(--success-light)', color: 'var(--success)', padding: '2px 8px', borderRadius: 6, border: '1px solid #bbf7d0', fontWeight: 600 }}>
                  ✓ Task Check-Off
                </span>
                <span style={{ fontSize: 11, background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 6, border: '1px solid #bfdbfe', fontWeight: 600 }}>
                  ✓ Vitals Access
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Modal */}
      {showModal && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-content">
            <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Link Family Caregiver</h3>
            <form onSubmit={handleLink}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Caregiver Account Username</label>
                <input required placeholder="e.g. caregiver1" value={newCg.caregiver_username}
                  onChange={e => setNewCg({ ...newCg, caregiver_username: e.target.value })}
                  className="saas-input" />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Relationship to Patient</label>
                <input required placeholder="e.g. Spouse, Daughter, Brother" value={newCg.relationship}
                  onChange={e => setNewCg({ ...newCg, relationship: e.target.value })}
                  className="saas-input" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Contact Phone (Optional)</label>
                <input placeholder="+91 98765 43210" value={newCg.phone}
                  onChange={e => setNewCg({ ...newCg, phone: e.target.value })}
                  className="saas-input" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowModal(false)} className="saas-btn saas-btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="saas-btn saas-btn-primary">
                  Link Caregiver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}



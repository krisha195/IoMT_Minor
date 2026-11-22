import { useState, useEffect } from 'react'
import api from '../api'

export default function ProfilePanel({ patientId, editable = true, onChatDoctor }) {
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({})
  const [saved, setSaved]     = useState(false)
  const [doctors, setDoctors] = useState([])

  useEffect(() => {
    api.get(`/api/profile/${patientId}`).then(r => {
      setProfile(r.data)
      setForm({ name: r.data.name, age: r.data.age || '', gender: r.data.gender || 'Male' })
      // fetch doctors only for patient profiles
      if (r.data.role === 'patient') {
        api.get('/api/doctors').then(d => setDoctors(d.data)).catch(() => {})
      }
    })
  }, [patientId])

  const save = async () => {
    await api.put(`/api/profile/${patientId}`, { ...form, age: parseInt(form.age) || null })
    setProfile(p => ({ ...p, ...form }))
    setEditing(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    const user = JSON.parse(localStorage.getItem('user'))
    if (user && user.patient_id === patientId)
      localStorage.setItem('user', JSON.stringify({ ...user, name: form.name }))
  }

  if (!profile) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#475569', padding: 24 }}>
      <div style={{ width: 18, height: 18, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      Loading profile...
    </div>
  )

  const isDoctor = profile.role === 'doctor'
  const avatarGrad = 'linear-gradient(135deg, #2563eb, #3b82f6)'

  const InfoRow = ({ label, value, icon }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{
        width: 38, height: 38, borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, marginTop: 1 }}>{value || '—'}</div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header card */}
      <div style={{
        background: '#ffffff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
        padding: '24px 28px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: avatarGrad,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 700, color: '#ffffff', flexShrink: 0,
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
        }}>{profile.name?.[0]?.toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{profile.name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{
              background: 'var(--primary-light)', border: '1px solid var(--primary-border)',
              color: 'var(--primary)', fontSize: 11.5, padding: '3px 10px', borderRadius: 'var(--radius-full)', fontWeight: 600
            }}>
              {isDoctor ? '👨‍⚕️ Clinician Doctor' : '🧑 Patient Account'}
            </span>
            {profile.gender && (
              <span style={{
                background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)', fontSize: 11.5, padding: '3px 10px', borderRadius: 'var(--radius-full)'
              }}>
                {profile.gender}
              </span>
            )}
            {profile.age && (
              <span style={{
                background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)', fontSize: 11.5, padding: '3px 10px', borderRadius: 'var(--radius-full)'
              }}>
                {profile.age} yrs
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info / Edit card */}
      <div style={{
        background: '#ffffff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
        padding: 24, marginBottom: 16, boxShadow: 'var(--shadow-sm)'
      }}>
        {!editing ? (
          <>
            <InfoRow icon="👤" label="Full Name" value={profile.name} />
            <InfoRow icon="🔑" label="Username"  value={profile.username} />
            <InfoRow icon="🎂" label="Age"        value={profile.age ? `${profile.age} years` : null} />
            <InfoRow icon="⚧"  label="Gender"     value={profile.gender} />

            {editable && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
                <button onClick={() => setEditing(true)} style={{
                  padding: '9px 20px', background: 'var(--primary)',
                  border: 'none', borderRadius: 'var(--radius-sm)', color: '#ffffff',
                  cursor: 'pointer', fontWeight: 600, fontSize: 13, boxShadow: '0 1px 3px rgba(37,99,235,0.25)'
                }}>✏️ Edit Profile</button>
                {saved && <span style={{ color: 'var(--success-text)', fontSize: 13, fontWeight: 600 }}>✓ Changes saved successfully</span>}
              </div>
            )}
          </>
        ) : (
          <>
            {[['👤 Full Name','name','text'],['🎂 Age','age','number']].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
                <input type={type} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 14px', background: '#ffffff',
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)', fontSize: 13.5, outline: 'none', boxShadow: 'var(--shadow-xs)'
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)' }}
                  onBlur={e  => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'var(--shadow-xs)' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>⚧ Gender</div>
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 14px', background: '#ffffff',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: 13.5, boxShadow: 'var(--shadow-xs)'
                }}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={save} style={{
                padding: '9px 20px', background: 'var(--primary)',
                border: 'none', borderRadius: 'var(--radius-sm)', color: '#ffffff',
                cursor: 'pointer', fontWeight: 600, fontSize: 13, boxShadow: '0 1px 3px rgba(37,99,235,0.25)'
              }}>Save Changes</button>
              <button onClick={() => setEditing(false)} style={{
                padding: '9px 18px', background: '#ffffff', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500
              }}>Cancel</button>
            </div>
          </>
        )}
      </div>

      {/* Doctors list — only shown on patient profile */}
      {!isDoctor && (
        <div style={{
          background: '#ffffff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
          padding: 24, boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>
            👨‍⚕️ Available Clinicians & Care Team ({doctors.length})
          </div>

          {doctors.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No doctors registered yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {doctors.map(doc => (
                <div key={doc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'var(--bg-canvas)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '12px 16px',
                  transition: 'all 0.15s ease'
                }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#ffffff' }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-canvas)' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#ffffff'
                  }}>{doc.name?.[0]?.toUpperCase()}</div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13.5 }}>{doc.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>
                      @{doc.username}
                      {doc.gender ? ` · ${doc.gender}` : ''}
                      {doc.age    ? ` · ${doc.age} yrs` : ''}
                    </div>
                  </div>

                  {/* Chat button */}
                  {onChatDoctor && (
                    <button onClick={() => onChatDoctor(doc)} style={{
                      padding: '7px 14px', background: 'var(--primary-light)',
                      border: '1px solid var(--primary-border)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#ffffff' }}
                      onMouseOut={e => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)' }}
                    >💬 Message</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

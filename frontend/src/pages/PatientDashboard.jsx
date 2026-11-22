import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getWebSocketUrl } from '../api'
import Sidebar from '../components/Sidebar'
import VitalCard from '../components/VitalCard'
import VitalsChart from '../components/VitalsChart'
import AlertBadge from '../components/AlertBadge'
import ChatPanel from '../components/ChatPanel'
import ProfilePanel from '../components/ProfilePanel'
import RiskScorePanel from '../components/RiskScorePanel'
import AIVitalSuggestions from '../components/AIVitalSuggestions'
import CareChecklist from '../components/CareChecklist'
import MedicationTracker from '../components/MedicationTracker'
import AICaregiverCopilot from '../components/AICaregiverCopilot'
import SurgeryHistory from '../components/SurgeryHistory'
import RecoveryProgress from '../components/RecoveryProgress'
import MotionCard from '../components/MotionCard'

function StatCard({ label, value, unit, color }) {
  return (
    <div className="saas-card" style={{ padding: '14px 18px', flex: 1, minWidth: 140 }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ color: color || 'var(--text-primary)', fontSize: 24, fontWeight: 800 }}>
        {value ?? '—'}<span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  )
}

function DoctorList({ selected, onSelect }) {
  const [doctors, setDoctors] = useState([])
  useEffect(() => {
    api.get('/api/doctors').then(r => {
      setDoctors(r.data)
      if (r.data.length > 0 && !selected) onSelect(r.data[0])
    }).catch(() => {})
  }, [])

  return (
    <div style={{ borderRight: '1px solid var(--border-default)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Doctors</div>
      {doctors.length === 0 && (
        <div style={{ padding: '16px', color: 'var(--text-light)', fontSize: 13 }}>No doctors found</div>
      )}
      {doctors.map(doc => {
        const isSel = selected?.id === doc.id
        return (
          <div key={doc.id} onClick={() => onSelect(doc)} style={{
            padding: '12px 16px', cursor: 'pointer',
            background: isSel ? 'var(--primary-light)' : 'transparent',
            borderBottom: '1px solid var(--border-default)', transition: 'background 0.15s'
          }}
            onMouseOver={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-canvas)' }}
            onMouseOut={e  => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0, boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}>
                {doc.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: isSel ? 700 : 500, color: isSel ? 'var(--primary)' : 'var(--text-primary)', fontSize: 13 }}>{doc.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>@{doc.username}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function PatientDashboard() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [active, setActive]         = useState('dashboard')
  const [patientId]                 = useState(user.patient_id)
  const [patientProfile, setProfile] = useState(null)
  const [vitals, setVitals]         = useState([])
  const [alerts, setAlerts]         = useState([])
  const [unread, setUnread]         = useState(0)
  const [dropdownOpen, setDropdown] = useState(false)
  const [chatDoctor, setChatDoctor] = useState(null)
  const [timeRange, setTimeRange]   = useState('')
  const wsRef = useRef(null)

  useEffect(() => {
    if (!user.token || user.role !== 'patient') {
      localStorage.clear()
      navigate('/login')
      return
    }
    api.get(`/api/profile/${user.patient_id}`).then(r => setProfile(r.data)).catch(() => {})
  }, [user.patient_id])

  const careStatus = patientProfile?.care_status || user.care_status || 'STANDARD_MONITORING'
  const isRecovery = careStatus === 'POST_TREATMENT_RECOVERY'

  const latest = vitals[vitals.length - 1] || {}

  const fetchData = async () => {
    if (!patientId) return
    const vitalsUrl = timeRange ? `/api/vitals/${patientId}?range=${timeRange}` : `/api/vitals/${patientId}?limit=60`
    const [v, a] = await Promise.all([
      api.get(vitalsUrl),
      api.get(`/api/alerts/${patientId}?limit=20`)
    ])
    setVitals(v.data)
    setAlerts(a.data)
  }

  const fetchUnread = async () => {
    const { data } = await api.get(`/api/messages/unread/${user.patient_id}`)
    setUnread(data.unread)
  }

  useEffect(() => {
    if (!patientId) return
    fetchData(); fetchUnread()
    const interval = setInterval(() => { fetchData(); fetchUnread() }, 3000)
    wsRef.current = new WebSocket(getWebSocketUrl('/ws/alerts'))
    wsRef.current.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === 'alert' && msg.patient_id === patientId) {
          fetchData()
        }
        if (msg.event === 'vital' && msg.patient_id === patientId) {
          setVitals(prev => {
            const next = [...prev, msg]
            return next.length > 60 ? next.slice(next.length - 60) : next
          })
        }
      } catch (err) {}
    }
    return () => { clearInterval(interval); wsRef.current?.close() }
  }, [patientId, timeRange])

  const acknowledge = async id => {
    await api.post(`/api/alerts/${id}/acknowledge`)
    fetchData()
  }

  const deleteAlert = async id => {
    try {
      await api.delete(`/api/alerts/single/${id}`)
      fetchData()
    } catch {}
  }

  const clearAllAlerts = async () => {
    if (!window.confirm('Are you sure you want to clear all alerts?')) return
    try {
      await api.delete(`/api/alerts/${patientId}`)
      fetchData()
    } catch {}
  }

  const exportCSV = () => {
    api.get(`/api/vitals/${patientId}/export`, { responseType: 'blob' }).then(r => {
      const url = URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url; a.download = `vitals_${patientId}.csv`; a.click()
    })
  }

  const unacknowledged = alerts.filter(a => !a.acknowledged).length

  const hrs   = vitals.map(v => parseFloat(v.hr)).filter(Boolean)
  const spo2s = vitals.map(v => parseFloat(v.spo2)).filter(Boolean)
  const temps = vitals.map(v => parseFloat(v.temperature)).filter(Boolean)
  const avg = arr => arr.length ? (arr.reduce((a,b) => a+b,0)/arr.length).toFixed(1) : null
  const min = arr => arr.length ? Math.min(...arr).toFixed(1) : null
  const max = arr => arr.length ? Math.max(...arr).toFixed(1) : null

  const pageTitle = {
    dashboard: 'My Dashboard',
    tasks: 'Daily Care Checklist',
    medications: 'Medication Tracking & Reconciliation',
    copilot: 'AI Recovery Copilot',
    history: 'Surgery & Major Treatment History',
    progress: 'Recovery Progress & Verification',
    vitals: 'Vitals History',
    alerts: 'Clinical Alerts',
    chat: 'Doctor Consultation Chat',
    profile: 'Profile Details'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <Sidebar
        role="patient"
        careStatus={careStatus}
        active={active}
        setActive={setActive}
        unread={unread}
      />

      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-canvas)' }}>
        {/* Topbar */}
        <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 50, boxShadow: 'var(--shadow-xs)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {pageTitle[active] || 'Dashboard'}
              </h1>

              {/* Eligibility Care Status Badge */}
              <span style={{
                fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '3px 10px', borderRadius: 20,
                background: isRecovery ? 'var(--primary-light)' : careStatus === 'RECOVERY_COMPLETED' ? 'var(--success-light)' : 'var(--bg-canvas)',
                color: isRecovery ? 'var(--primary)' : careStatus === 'RECOVERY_COMPLETED' ? 'var(--success)' : 'var(--text-secondary)',
                border: `1px solid ${isRecovery ? '#bfdbfe' : careStatus === 'RECOVERY_COMPLETED' ? '#bbf7d0' : 'var(--border-default)'}`
              }}>
                {isRecovery ? '🏥 Post-Treatment Recovery' : careStatus === 'RECOVERY_COMPLETED' ? '✓ Recovery Completed' : '📡 Standard Monitoring'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '2px 0 0 0' }}>
              Logged in as {user.name} {patientProfile?.surgery_name ? `• ${patientProfile.surgery_name}` : ''}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {unacknowledged > 0 && (
              <div onClick={() => setActive('alerts')} style={{ background: 'var(--danger-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--danger)', fontWeight: 600, cursor: 'pointer' }}>
                🚨 {unacknowledged} alert{unacknowledged > 1 ? 's' : ''}
              </div>
            )}
            {active === 'vitals' && (
              <button onClick={exportCSV} className="saas-btn saas-btn-primary" style={{ padding: '8px 16px', fontSize: 13, background: '#16a34a' }}>
                ⬇ Export CSV
              </button>
            )}

            {/* Profile Avatar */}
            <div style={{ position: 'relative' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'white', cursor: 'pointer', userSelect: 'none', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
                onClick={() => setDropdown(d => !d)}>
                {user.name?.[0]?.toUpperCase()}
              </div>
              {dropdownOpen && (
                <div style={{ position: 'absolute', right: 0, top: 44, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, minWidth: 180, boxShadow: 'var(--shadow-lg)', zIndex: 200 }}
                  onMouseLeave={() => setDropdown(false)}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{user.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11, textTransform: 'capitalize' }}>{user.role}</div>
                  </div>
                  {[['👤 My Profile','profile'],['🔔 Alerts','alerts'],['💬 Chat','chat']].map(([label, page]) => (
                    <div key={page} onClick={() => { setActive(page); setDropdown(false) }} style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--bg-canvas)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      {label}
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-default)' }}>
                    <div onClick={() => { localStorage.clear(); window.location='/login' }} style={{ padding: '10px 16px', color: 'var(--danger)', fontSize: 13, cursor: 'pointer' }}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--danger-light)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      🚪 Sign Out
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 28px' }}>

          {/* ── Main Dashboard ── */}
          {active === 'dashboard' && (
            <>
              {/* SECTION 1: AI-Based Vital Suggestions (Available to ALL Patients) */}
              {patientId && <AIVitalSuggestions patientId={patientId} />}

              {/* Explainable Health Risk Score */}
              {patientId && <RiskScorePanel patientId={patientId} />}

              {/* IoMT Hardware Connection & Status Banner */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px',
                background: Boolean(latest.timestamp && (Date.now() - new Date(latest.timestamp).getTime() < 30000)) ? '#f0fdf4' : '#f8fafc',
                border: `1px solid ${Boolean(latest.timestamp && (Date.now() - new Date(latest.timestamp).getTime() < 30000)) ? '#bbf7d0' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-md)',
                marginBottom: 18,
                flexWrap: 'wrap',
                gap: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: Boolean(latest.timestamp && (Date.now() - new Date(latest.timestamp).getTime() < 30000)) ? '#10b981' : '#94a3b8',
                    display: 'inline-block',
                    animation: Boolean(latest.timestamp && (Date.now() - new Date(latest.timestamp).getTime() < 30000)) ? 'pulseLive 2s infinite' : 'none'
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: Boolean(latest.timestamp && (Date.now() - new Date(latest.timestamp).getTime() < 30000)) ? '#166534' : 'var(--text-secondary)' }}>
                    {Boolean(latest.timestamp && (Date.now() - new Date(latest.timestamp).getTime() < 30000)) ? 'IoMT Sensor Online: Real-Time Stream Active' : 'IoMT Sensor Standby / Waiting for Device'}
                  </span>
                  {latest.timestamp && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      • Last updated: {new Date(latest.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => {
                    const isFingerOff = latest.finger_detected === false || latest.hr == null || latest.spo2 == null
                    return (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 12,
                        background: isFingerOff ? '#fff7ed' : '#f0fdf4',
                        color: isFingerOff ? '#c2410c' : '#166534',
                        border: `1px solid ${isFingerOff ? '#fed7aa' : '#bbf7d0'}`
                      }}>
                        {isFingerOff ? '⚠️ Finger Off Sensor' : '✓ Sensor Attached'}
                      </span>
                    )
                  })()}
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 12,
                    background: latest.motion_status === 'HIGH' ? '#fef2f2' : latest.motion_status === 'MODERATE' ? '#fffbeb' : '#f0fdf4',
                    color: latest.motion_status === 'HIGH' ? '#dc2626' : latest.motion_status === 'MODERATE' ? '#d97706' : '#166534',
                    border: `1px solid ${latest.motion_status === 'HIGH' ? '#fecaca' : latest.motion_status === 'MODERATE' ? '#fde68a' : '#bbf7d0'}`
                  }}>
                    🏃 {latest.motion_status || 'STABLE'}
                  </span>
                </div>
              </div>

              {/* Live Vital Cards */}
              {(() => {
                const isFingerOff = latest.finger_detected === false || latest.hr == null || latest.spo2 == null
                return (
                  <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                    <VitalCard
                      label="Heart Rate"
                      value={isFingerOff ? null : latest.hr}
                      unit="bpm"
                      icon="❤️"
                      vital="hr"
                      fingerDetected={!isFingerOff}
                      subtitle="Pulse Rate"
                    />
                    <VitalCard
                      label="SpO₂ Oxygen"
                      value={isFingerOff ? null : latest.spo2}
                      unit="%"
                      icon="🫁"
                      vital="spo2"
                      fingerDetected={!isFingerOff}
                      subtitle="Blood Oxygen"
                    />
                    <VitalCard
                      label="Body Temperature"
                      value={latest.temperature}
                      unit="°C"
                      icon="🌡️"
                      vital="temperature"
                      subtitle="Oral Equivalent"
                    />
                    <VitalCard
                      label="Physical Activity"
                      value={latest.motion_status || 'STABLE'}
                      unit=""
                      icon="🏃"
                      vital="motion_status"
                      subtitle={latest.motion_score != null ? `${Number(latest.motion_score).toFixed(4)}g motion` : 'Resting'}
                    />
                  </div>
                )
              })()}

              {/* Acceleration & Motion Surveillance Card */}
              <MotionCard
                ax={latest.ax}
                ay={latest.ay}
                az={latest.az}
                motionScore={latest.motion_score}
                motionStatus={latest.motion_status}
                fingerDetected={latest.finger_detected}
                isDoctor={false}
              />

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <StatCard label="Avg HR"    value={avg(hrs)}   unit="bpm" color="#ef4444" />
                <StatCard label="Min SpO₂" value={min(spo2s)} unit="%"   color="#2563eb" />
                <StatCard label="Avg Temp" value={avg(temps)} unit="°C"  color="#16a34a" />
                <StatCard label="Alerts"   value={alerts.length} unit="" color="#d97706" />
              </div>

              {/* Charts & Alerts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 22 }}>
                <div>
                  <VitalsChart data={vitals} vital="hr" range={timeRange} onRangeChange={setTimeRange} />
                  <VitalsChart data={vitals} vital="spo2" range={timeRange} onRangeChange={setTimeRange} />
                  <VitalsChart data={vitals} vital="temperature" range={timeRange} onRangeChange={setTimeRange} />
                  <VitalsChart data={vitals} vital="motion" range={timeRange} onRangeChange={setTimeRange} />
                </div>
                <div className="saas-card" style={{ padding: 20, maxHeight: 520, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Recent Alerts {unacknowledged > 0 && <span style={{ background: 'var(--danger)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 10, marginLeft: 6 }}>{unacknowledged}</span>}
                    </div>
                    {alerts.length > 0 && (
                      <button onClick={clearAllAlerts} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}
                        onMouseOver={e => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                        Clear All
                      </button>
                    )}
                  </div>
                  {alerts.slice(0,5).length === 0
                    ? <p style={{ color: 'var(--text-light)', fontSize: 13 }}>No alerts — all clear ✓</p>
                    : alerts.slice(0,5).map(a => <AlertBadge key={a.id} alert={a} onAck={acknowledge} onDelete={deleteAlert} />)
                  }
                  {alerts.length > 5 && (
                    <button onClick={() => setActive('alerts')} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, marginTop: 10, fontWeight: 600 }}>
                      View all {alerts.length} alerts →
                    </button>
                  )}
                </div>
              </div>

              {/* If Post-Treatment Recovery, show inline Care Checklist on dashboard */}
              {isRecovery && patientId && (
                <CareChecklist patientId={patientId} careStatus={careStatus} />
              )}
            </>
          )}

          {/* ── Post-Treatment Recovery Modules (MAJOR-TREATMENT PATIENTS ONLY) ── */}
          {active === 'tasks' && isRecovery && patientId && (
            <CareChecklist patientId={patientId} careStatus={careStatus} />
          )}

          {active === 'medications' && isRecovery && patientId && (
            <MedicationTracker patientId={patientId} careStatus={careStatus} />
          )}

          {active === 'copilot' && patientId && (
            <AICaregiverCopilot patientId={patientId} patientName={patientProfile?.name || user.name} />
          )}

          {active === 'history' && (isRecovery || careStatus === 'RECOVERY_COMPLETED') && patientId && (
            <SurgeryHistory patientId={patientId} />
          )}

          {active === 'progress' && isRecovery && patientId && (
            <RecoveryProgress patientId={patientId} />
          )}

          {/* ── Standard Monitoring Modules ── */}
          {active === 'vitals' && (
            <div style={{ maxWidth: 900 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <StatCard label="Avg HR"   value={avg(hrs)}   unit="bpm" color="#ef4444" />
                <StatCard label="Min HR"   value={min(hrs)}   unit="bpm" color="#ef4444" />
                <StatCard label="Max HR"   value={max(hrs)}   unit="bpm" color="#ef4444" />
                <StatCard label="Avg SpO₂" value={avg(spo2s)} unit="%"   color="#2563eb" />
                <StatCard label="Min SpO₂" value={min(spo2s)} unit="%"   color="#2563eb" />
                <StatCard label="Avg Temp" value={avg(temps)} unit="°C"  color="#16a34a" />
              </div>
              <VitalsChart data={vitals} vital="hr" range={timeRange} onRangeChange={setTimeRange} />
              <VitalsChart data={vitals} vital="spo2" range={timeRange} onRangeChange={setTimeRange} />
              <VitalsChart data={vitals} vital="temperature" range={timeRange} onRangeChange={setTimeRange} />
              <VitalsChart data={vitals} vital="motion" range={timeRange} onRangeChange={setTimeRange} />
            </div>
          )}

          {active === 'alerts' && (
            <div style={{ maxWidth: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['all','critical','high','medium'].map(f => (
                    <span key={f} style={{
                      padding: '5px 14px', borderRadius: 20, background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer', boxShadow: 'var(--shadow-xs)'
                    }}>
                      {f.charAt(0).toUpperCase()+f.slice(1)} ({f === 'all' ? alerts.length : alerts.filter(a => a.severity === f).length})
                    </span>
                  ))}
                </div>
                {alerts.length > 0 && (
                  <button onClick={clearAllAlerts} style={{
                    padding: '6px 14px', background: 'var(--danger-light)', border: '1px solid #fecaca',
                    borderRadius: 8, color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>
                    🗑️ Clear All Alerts
                  </button>
                )}
              </div>
              {alerts.length === 0
                ? <p style={{ color: 'var(--text-light)', fontSize: 13 }}>No alerts — all clear ✓</p>
                : alerts.map(a => <AlertBadge key={a.id} alert={a} onAck={acknowledge} onDelete={deleteAlert} />)
              }
            </div>
          )}

          {active === 'chat' && (
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 0, height: 'calc(100vh - 140px)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <DoctorList selected={chatDoctor} onSelect={setChatDoctor} />
              {chatDoctor
                ? <ChatPanel currentUserId={user.patient_id} otherUserId={chatDoctor.id} otherName={chatDoctor.name} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', fontSize: 14 }}>Select a doctor to start chatting</div>
              }
            </div>
          )}

          {active === 'profile' && patientId && (
            <ProfilePanel
              patientId={patientId}
              editable={true}
              onChatDoctor={doc => { setChatDoctor({ id: doc.id, name: doc.name }); setActive('chat') }}
            />
          )}

        </div>
      </main>
    </div>
  )
}


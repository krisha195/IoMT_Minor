import { useEffect, useState, useRef } from 'react'
import api from '../api'
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
import SurgeryHistory from '../components/SurgeryHistory'
import DeteriorationAlerts from '../components/DeteriorationAlerts'
import RecoveryProgress from '../components/RecoveryProgress'
import CaregiverCoordination from '../components/CaregiverCoordination'
import MotionCard from '../components/MotionCard'

export default function DoctorDashboard() {
  const user = JSON.parse(localStorage.getItem('user'))
  const [active, setActive]         = useState('dashboard')
  const [patientTab, setPatientTab] = useState('vitals') // vitals, tasks, meds, history, deterioration, progress, caregivers
  const [patients, setPatients]     = useState([])
  const [selected, setSelected]     = useState(null)
  const [vitals, setVitals]         = useState([])
  const [alerts, setAlerts]         = useState([])
  const [latestMap, setLatestMap]   = useState({})
  const [liveAlerts, setLiveAlerts] = useState([])
  const [unread, setUnread]         = useState(0)
  const [chatPatient, setChatPatient] = useState(null)
  const [dropdownOpen, setDropdown]   = useState(false)
  const [enrolling, setEnrolling]     = useState(false)
  const [timeRange, setTimeRange]     = useState('')
  const wsRef = useRef(null)
  const selectedRef = useRef(selected)

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  const latest = vitals[vitals.length - 1] || {}

  const loadPatients = () => {
    api.get('/api/patients').then(r => {
      setPatients(r.data)
      if (r.data.length > 0 && !selected) {
        setSelected(r.data[0].id)
        setChatPatient(r.data[0])
      }
    }).catch(() => {})
  }

  useEffect(() => {
    loadPatients()
    const wsHost = window.location.hostname || 'localhost'
    wsRef.current = new WebSocket(`ws://${wsHost}:8001/ws/alerts`)
    wsRef.current.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === 'alert' && ['critical','high'].includes(msg.severity)) {
          setLiveAlerts(prev => [msg, ...prev].slice(0, 8))
        }
        if (msg.event === 'vital') {
          setLatestMap(prev => ({
            ...prev,
            [msg.patient_id]: {
              ...(prev[msg.patient_id] || {}),
              ...msg
            }
          }))
          if (msg.patient_id === selectedRef.current) {
            setVitals(prev => {
              const next = [...prev, msg]
              return next.length > 60 ? next.slice(next.length - 60) : next
            })
          }
        }
      } catch (err) {}
    }
    return () => wsRef.current?.close()
  }, [])

  useEffect(() => {
    if (!patients.length) return
    const fetch = async () => {
      const results = await Promise.all(patients.map(p => api.get(`/api/patients/${p.id}/latest`)))
      const map = {}
      patients.forEach((p, i) => { map[p.id] = results[i].data })
      setLatestMap(map)
    }
    fetch()
    const interval = setInterval(fetch, 3000)
    return () => clearInterval(interval)
  }, [patients])

  useEffect(() => {
    if (!selected) return
    const fetch = async () => {
      const vitalsUrl = timeRange ? `/api/vitals/${selected}?range=${timeRange}` : `/api/vitals/${selected}?limit=60`
      const [v, a] = await Promise.all([
        api.get(vitalsUrl),
        api.get(`/api/alerts/${selected}?limit=20`)
      ])
      setVitals(v.data); setAlerts(a.data)
    }
    fetch()
    const interval = setInterval(fetch, 3000)
    return () => clearInterval(interval)
  }, [selected, timeRange])

  useEffect(() => {
    const fetchUnread = async () => {
      const { data } = await api.get(`/api/messages/unread/${user.patient_id}`)
      setUnread(data.unread)
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 5000)
    return () => clearInterval(interval)
  }, [])

  const selectedPatient = patients.find(p => p.id === selected)
  const isSelectedRecovery = selectedPatient?.care_status === 'POST_TREATMENT_RECOVERY'
  const isSelectedCompleted = selectedPatient?.care_status === 'RECOVERY_COMPLETED'

  const deleteAlert = async (id) => {
    try {
      await api.delete(`/api/alerts/single/${id}`)
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  const clearAllAlerts = async () => {
    if (!window.confirm('Are you sure you want to clear all alerts?')) return
    try {
      await api.delete('/api/alerts')
      setAlerts([])
      setLiveAlerts([])
    } catch {}
  }

  const updatePatientCareStatus = async (newStatus) => {
    if (!selected) return
    setEnrolling(true)
    try {
      await api.put(`/api/patients/${selected}/care-status`, { care_status: newStatus })
      loadPatients()
      alert(`Patient care status updated to: ${newStatus}`)
    } catch {
      alert('Failed to update patient care status')
    } finally {
      setEnrolling(false)
    }
  }

  const StatusDot = ({ vital, value }) => {
    const ranges = { hr: [40,150], spo2: [90,100], temperature: [25.0, 35.0] }
    const [lo, hi] = ranges[vital] || [0,9999]
    const bad = value != null && (value < lo || value > hi)
    return <span style={{ color: bad ? '#ef4444' : '#22c55e', fontSize: 12 }}>{value ?? '—'}</span>
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <Sidebar role="doctor" active={active} setActive={setActive} unread={unread} />

      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-canvas)' }}>
        {/* Top bar */}
        <div style={{
          padding: '16px 28px', borderBottom: '1px solid var(--border-default)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 50,
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {active === 'dashboard' && 'Clinical Overview'}
              {active === 'patients'  && 'Patient Monitor & Recovery Management'}
              {active === 'alerts'    && 'Critical Alarms'}
              {active === 'chat'      && 'Patient Teleconsultation'}
              {active === 'profile'   && 'Physician Profile'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '2px 0 0 0' }}>Dr. {user.name} • Surgical & Telemetry Monitoring</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {liveAlerts.length > 0 && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--danger)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setActive('alerts')}>
                🚨 {liveAlerts.length} live alert{liveAlerts.length > 1 ? 's' : ''}
              </div>
            )}
            {/* Profile dropdown */}
            <div style={{ position: 'relative' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'white', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
                onClick={() => setDropdown(d => !d)}>
                {user.name?.[0]?.toUpperCase() || 'D'}
              </div>
              {dropdownOpen && (
                <div style={{ position: 'absolute', right: 0, top: 44, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, minWidth: 180, boxShadow: 'var(--shadow-lg)', zIndex: 200 }}
                  onMouseLeave={() => setDropdown(false)}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{user.name}</div>
                    <div style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 500 }}>👨‍⚕️ Physician</div>
                  </div>
                  {[['👥 Patients','patients'],['🚨 Alerts','alerts'],['💬 Chat','chat'],['👤 Profile','profile']].map(([label, page]) => (
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

          {/* Overview */}
          {active === 'dashboard' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                {patients.map(p => {
                  const lv = latestMap[p.id] || {}
                  const hasAlert = lv.hr && (lv.hr < 40 || lv.hr > 150 || lv.spo2 < 90)
                  const isRec = p.care_status === 'POST_TREATMENT_RECOVERY'

                  return (
                    <div key={p.id} onClick={() => { setSelected(p.id); setActive('patients') }}
                      className="saas-card"
                      style={{
                        padding: '18px 20px', cursor: 'pointer',
                        borderColor: hasAlert ? '#fca5a5' : 'var(--border-default)',
                        boxShadow: hasAlert ? '0 0 0 2px rgba(239,68,68,0.15)' : 'var(--shadow-xs)'
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{p.name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.age}y · {p.gender}</div>
                        </div>

                        {/* Status badge */}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, height: 'fit-content',
                          background: isRec ? 'var(--primary-light)' : 'var(--bg-canvas)',
                          color: isRec ? 'var(--primary)' : 'var(--text-secondary)',
                          border: `1px solid ${isRec ? '#bfdbfe' : 'var(--border-default)'}`
                        }}>
                          {isRec ? 'Post-Op Recovery' : 'Standard'}
                        </span>
                      </div>

                      {p.surgery_name && (
                        <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 10, fontWeight: 500 }}>
                          🩺 {p.surgery_name}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 12, fontSize: 13, background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', padding: '8px 12px', borderRadius: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>❤️ <StatusDot vital="hr" value={lv.hr} /></span>
                        <span>🫁 <StatusDot vital="spo2" value={lv.spo2} />%</span>
                        <span>🌡️ <StatusDot vital="temperature" value={lv.temperature} />°C</span>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: lv.motion_status === 'HIGH' ? '#fef2f2' : lv.motion_status === 'MODERATE' ? '#fffbeb' : '#f0fdf4',
                          color: lv.motion_status === 'HIGH' ? '#dc2626' : lv.motion_status === 'MODERATE' ? '#d97706' : '#166534',
                          border: `1px solid ${lv.motion_status === 'HIGH' ? '#fecaca' : lv.motion_status === 'MODERATE' ? '#fde68a' : '#bbf7d0'}`
                        }}>
                          🏃 {lv.motion_status || 'STABLE'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Live alerts feed */}
              {liveAlerts.length > 0 && (
                <div className="saas-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Alerts Feed</span>
                    <button onClick={() => setLiveAlerts([])} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>Clear</button>
                  </div>
                  {liveAlerts.map((a, i) => <AlertBadge key={i} alert={a} />)}
                </div>
              )}
            </>
          )}


          {/* Patient Monitor */}
          {active === 'patients' && (
            <>
              {/* Patient Selector Pills */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                {patients.map(p => (
                  <button key={p.id} onClick={() => { setSelected(p.id); setPatientTab('vitals') }} style={{
                    padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                    background: selected === p.id ? 'var(--primary)' : 'var(--bg-surface)',
                    color: selected === p.id ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: selected === p.id ? 600 : 500,
                    fontSize: 13, border: selected === p.id ? '1px solid var(--primary)' : '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-xs)', transition: 'all 0.15s'
                  }}>
                    {p.name} {p.care_status === 'POST_TREATMENT_RECOVERY' ? '🏥' : '📡'}
                  </button>
                ))}
              </div>

              {selectedPatient && (
                <>
                  {/* Patient Care Status & Enrollment Control Bar */}
                  <div className="saas-card" style={{
                    padding: '16px 20px', marginBottom: 20, display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {selectedPatient.name}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20,
                          background: isSelectedRecovery ? 'var(--primary-light)' : isSelectedCompleted ? 'var(--success-light)' : 'var(--bg-canvas)',
                          color: isSelectedRecovery ? 'var(--primary)' : isSelectedCompleted ? 'var(--success)' : 'var(--text-secondary)',
                          border: `1px solid ${isSelectedRecovery ? '#bfdbfe' : isSelectedCompleted ? '#bbf7d0' : 'var(--border-default)'}`
                        }}>
                          {selectedPatient.care_status || 'STANDARD_MONITORING'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                        {selectedPatient.primary_diagnosis || selectedPatient.surgery_name || 'General Clinical Telemetry Monitoring'}
                      </div>
                    </div>

                    {/* Eligibility Control Buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!isSelectedRecovery && (
                        <button
                          disabled={enrolling}
                          onClick={() => updatePatientCareStatus('POST_TREATMENT_RECOVERY')}
                          className="saas-btn saas-btn-primary"
                          style={{ padding: '7px 14px', fontSize: 12 }}
                        >
                          {enrolling ? 'Enrolling...' : '🏥 Enroll in Post-Treatment Recovery'}
                        </button>
                      )}

                      {isSelectedRecovery && (
                        <>
                          <button
                            disabled={enrolling}
                            onClick={() => updatePatientCareStatus('RECOVERY_COMPLETED')}
                            className="saas-btn saas-btn-primary"
                            style={{ padding: '7px 14px', fontSize: 12, background: '#16a34a' }}
                          >
                            ✓ Mark Recovery Completed
                          </button>
                          <button
                            disabled={enrolling}
                            onClick={() => updatePatientCareStatus('STANDARD_MONITORING')}
                            className="saas-btn saas-btn-secondary"
                            style={{ padding: '7px 14px', fontSize: 12 }}
                          >
                            Revert to Standard
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Secondary Tab Navigation for Selected Patient */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-default)', paddingBottom: 10, flexWrap: 'wrap' }}>
                    {[
                      ['vitals', '📊 Vitals & AI Suggestions'],
                      ...(isSelectedRecovery ? [
                        ['tasks', '📋 Care Checklist'],
                        ['meds', '💊 Medications & Reconciliation'],
                        ['history', '📜 Surgery History'],
                        ['deterioration', '🚨 Early Deterioration'],
                        ['progress', '📈 Recovery Progress']
                      ] : [])
                    ].map(([tabKey, tabLabel]) => (
                      <button key={tabKey} onClick={() => setPatientTab(tabKey)} style={{
                        padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                        background: patientTab === tabKey ? 'var(--primary-light)' : 'transparent',
                        color: patientTab === tabKey ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: patientTab === tabKey ? 600 : 500, fontSize: 13,
                        border: patientTab === tabKey ? '1px solid #bfdbfe' : '1px solid transparent',
                        transition: 'all 0.15s'
                      }}>
                        {tabLabel}
                      </button>
                    ))}
                    {!isSelectedRecovery && (
                      <span style={{ fontSize: 12, color: 'var(--text-light)', alignSelf: 'center', marginLeft: 10 }}>
                        (Recovery modules disabled for Standard Monitoring patient)
                      </span>
                    )}
                  </div>

                  {/* Vitals Tab */}
                  {patientTab === 'vitals' && (
                    <>
                      {/* Section 1: AI-Based Vital Suggestions (ALL PATIENTS) */}
                      <AIVitalSuggestions patientId={selected} />

                      {/* Explainable Health Risk Score */}
                      <RiskScorePanel patientId={selected} />

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
                            {Boolean(latest.timestamp && (Date.now() - new Date(latest.timestamp).getTime() < 30000)) ? 'ESP32 IoMT Node: Active & Streaming' : 'ESP32 IoMT Node: Standby / Awaiting Packets'}
                          </span>
                          {latest.timestamp && (
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              • Last packet: {new Date(latest.timestamp).toLocaleTimeString()}
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
                                {isFingerOff ? '⚠️ MAX30102: Finger Detached' : '✓ MAX30102: Finger In Contact'}
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
                            🏃 Motion: {latest.motion_status || 'STABLE'}
                          </span>
                        </div>
                      </div>

                      {/* 4 Primary Metric Cards */}
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
                              subtitle="MAX30102 Optical PPG"
                            />
                            <VitalCard
                              label="SpO₂ Oxygen"
                              value={isFingerOff ? null : latest.spo2}
                              unit="%"
                              icon="🫁"
                              vital="spo2"
                              fingerDetected={!isFingerOff}
                              subtitle="MAX30102 Red/IR Ratio"
                            />
                            <VitalCard
                              label="Body Temperature"
                              value={latest.temperature}
                              unit="°C"
                              icon="🌡️"
                              vital="temperature"
                              subtitle="LM35 Precision Analog"
                            />
                            <VitalCard
                              label="Motion Activity"
                              value={latest.motion_status || 'STABLE'}
                              unit=""
                              icon="🏃"
                              vital="motion_status"
                              subtitle={latest.motion_score != null ? `${Number(latest.motion_score).toFixed(4)}g delta` : 'MPU6500 Kinematic'}
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
                        isDoctor={true}
                      />

                      {/* Telemetry Charts & Alerts Sidebar */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
                        <div>
                          <VitalsChart data={vitals} vital="hr" range={timeRange} onRangeChange={setTimeRange} />
                          <VitalsChart data={vitals} vital="spo2" range={timeRange} onRangeChange={setTimeRange} />
                          <VitalsChart data={vitals} vital="temperature" range={timeRange} onRangeChange={setTimeRange} />
                          <VitalsChart data={vitals} vital="motion" range={timeRange} onRangeChange={setTimeRange} />
                        </div>
                        <div className="saas-card" style={{ padding: 20, maxHeight: 680, overflowY: 'auto' }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Alerts & Alarms</div>
                          {alerts.length === 0
                            ? <p style={{ color: 'var(--text-light)', fontSize: 13 }}>No alerts</p>
                            : alerts.map(a => <AlertBadge key={a.id} alert={a} />)
                          }
                        </div>
                      </div>
                    </>
                  )}

                  {/* Recovery Specific Tabs (Available for Post-Treatment Recovery Patients) */}
                  {patientTab === 'tasks' && isSelectedRecovery && (
                    <CareChecklist patientId={selected} isDoctor={true} careStatus={selectedPatient.care_status} />
                  )}

                  {patientTab === 'meds' && isSelectedRecovery && (
                    <MedicationTracker patientId={selected} isDoctor={true} careStatus={selectedPatient.care_status} />
                  )}

                  {patientTab === 'history' && isSelectedRecovery && (
                    <SurgeryHistory patientId={selected} isDoctor={true} />
                  )}

                  {patientTab === 'deterioration' && isSelectedRecovery && (
                    <DeteriorationAlerts patientId={selected} isDoctor={true} />
                  )}

                  {patientTab === 'progress' && isSelectedRecovery && (
                    <RecoveryProgress patientId={selected} isDoctor={true} />
                  )}
                </>
              )}
            </>
          )}

          {/* All Alerts */}
          {active === 'alerts' && (
            <div style={{ maxWidth: 700 }}>
              {liveAlerts.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Live System Alarms</div>
                  {liveAlerts.map((a, i) => <AlertBadge key={i} alert={a} />)}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedPatient?.name} — Recent Alerts
                </div>
                {alerts.length > 0 && (
                  <button onClick={clearAllAlerts} style={{
                    padding: '4px 10px', background: 'var(--danger-light)', border: '1px solid #fecaca',
                    borderRadius: 6, color: 'var(--danger)', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                  }}>
                    🗑️ Clear All Alerts
                  </button>
                )}
              </div>
              {alerts.length === 0
                ? <p style={{ color: 'var(--text-light)', fontSize: 13 }}>No alerts — all clear ✓</p>
                : alerts.map(a => <AlertBadge key={a.id} alert={a} onDelete={deleteAlert} />)
              }
            </div>
          )}

          {/* Profile */}
          {active === 'profile' && (
            <ProfilePanel patientId={user.patient_id} editable={true} />
          )}

          {/* Chat */}
          {active === 'chat' && (
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 0, height: 'calc(100vh - 140px)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ borderRight: '1px solid var(--border-default)', overflowY: 'auto' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patients</div>
                {patients.map(p => (
                  <div key={p.id} onClick={() => setChatPatient(p)} style={{
                    padding: '12px 16px', cursor: 'pointer',
                    background: chatPatient?.id === p.id ? 'var(--primary-light)' : 'transparent',
                    borderBottom: '1px solid var(--border-default)',
                    transition: 'background 0.15s'
                  }}>
                    <div style={{ fontWeight: chatPatient?.id === p.id ? 700 : 500, color: chatPatient?.id === p.id ? 'var(--primary)' : 'var(--text-primary)', fontSize: 13 }}>{p.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>{p.age}y · {p.gender}</div>
                  </div>
                ))}
              </div>
              {chatPatient && (
                <ChatPanel
                  currentUserId={user.patient_id}
                  otherUserId={chatPatient.id}
                  otherName={chatPatient.name}
                />
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}


import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'
import './Login.css'

export default function Signup() {
  const [form, setForm] = useState({
    username: '', password: '', confirm: '',
    name: '', age: '', gender: 'Male', role: 'patient'
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) return setError('Passwords do not match')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    try {
      const { data } = await api.post('/api/signup', {
        username: form.username, password: form.password, role: form.role
      })
      await api.put(`/api/profile/${data.patient_id}`,
        { name: form.name || form.username, age: parseInt(form.age) || null, gender: form.gender },
        { headers: { Authorization: `Bearer ${data.access_token}` } }
      )
      localStorage.setItem('user', JSON.stringify({
        token: data.access_token, role: data.role,
        name: form.name || form.username, patient_id: data.patient_id
      }))
      navigate(data.role === 'doctor' ? '/doctor' : '/patient')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const isDoctor = form.role === 'doctor'

  return (
    <div className="login-bg">
      <div className="login-card" style={{ maxWidth: 500 }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 500, marginBottom: 16 }}>
          ← Back to Overview
        </Link>
        <Link to="/" className="login-brand" style={{ textDecoration: 'none' }}>
          <div className="login-brand-icon">🫀</div>
          <div>
            <div className="login-brand-name">PulseNet</div>
            <div className="login-brand-sub">Every Pulse Matters · Clinical Telemetry</div>
          </div>
        </Link>

        <h2>Create an Account</h2>
        <p>Register as a patient or clinician on the IoMT platform</p>

        {/* Role Segmented Control */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20,
          background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: 4,
          border: '1px solid var(--border-default)'
        }}>
          {[['patient','🧑 Patient Account'],['doctor','👨‍⚕️ Clinician / Doctor']].map(([r, label]) => (
            <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))} style={{
              flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: form.role === r ? 600 : 500, transition: 'all 0.15s ease',
              background: form.role === r ? '#ffffff' : 'transparent',
              color: form.role === r ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: form.role === r ? 'var(--shadow-xs)' : 'none'
            }}>{label}</button>
          ))}
        </div>

        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>{isDoctor ? 'Doctor Name' : 'Full Name'}</label>
              <input placeholder={isDoctor ? 'Dr. Sharma' : 'e.g. Rahul Mehta'} value={form.name} onChange={set('name')} />
            </div>
            <div className="form-group">
              <label>Age</label>
              <input type="number" placeholder="Age" value={form.age} min={1} max={120} onChange={set('age')} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Gender</label>
              <select value={form.gender} onChange={set('gender')} style={{
                width: '100%', padding: '11px 14px', background: '#ffffff',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)', fontSize: 13.5, boxShadow: 'var(--shadow-xs)'
              }}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Username</label>
              <input placeholder="Choose username" value={form.username} onChange={set('username')} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="Min 6 chars" value={form.password} onChange={set('password')} required />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} required />
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : `Create ${isDoctor ? 'Doctor' : 'Patient'} Account`}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 13 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

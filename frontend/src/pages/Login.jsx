import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'
import './Login.css'

export default function Login() {
  const [form, setForm]   = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { data } = await api.post('/api/login', form)
      localStorage.setItem('user', JSON.stringify({
        token: data.access_token,
        role: data.role,
        name: data.name,
        patient_id: data.patient_id,
        care_status: data.care_status
      }))
      navigate(data.role === 'doctor' ? '/doctor' : '/patient')
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
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

        <h2>Welcome back</h2>
        <p>Sign in to access your clinical dashboard</p>

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Username</label>
            <input placeholder="Enter username" value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="Enter password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-creds">
          <div className="demo-creds-title">Demo Accounts (Click to Fill)</div>
          <div className="demo-chip" onClick={() => setForm({ username: 'doctor', password: 'doctor123' })}>
            <span><strong>👨‍⚕️ Doctor Portal</strong> (Dr. Sharma)</span>
            <code>doctor</code>
          </div>
          <div className="demo-chip" onClick={() => setForm({ username: 'patient1', password: 'patient123' })}>
            <span><strong>🏥 Patient 1</strong> (Post-Op Recovery)</span>
            <code>patient1</code>
          </div>
          <div className="demo-chip" onClick={() => setForm({ username: 'patient2', password: 'pass123' })}>
            <span><strong>📡 Patient 2</strong> (Standard Telemetry)</span>
            <code>patient2</code>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 13 }}>
          New to the platform?{' '}
          <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}

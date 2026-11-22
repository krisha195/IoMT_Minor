import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: 'var(--bg-canvas)', color: 'var(--text-primary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, fontFamily: 'system-ui, sans-serif'
        }}>
          <div className="saas-card" style={{
            padding: 36, maxWidth: 500, width: '100%', textAlign: 'center',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px 0', color: 'var(--danger)' }}>
              Something went wrong loading this view
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, margin: '0 0 24px 0' }}>
              An error occurred while rendering the dashboard. Click below to refresh or return to login.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => { localStorage.clear(); window.location.href = '/login' }}
                className="saas-btn saas-btn-primary"
              >
                Sign In Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="saas-btn saas-btn-secondary"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}


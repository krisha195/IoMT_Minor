import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null')

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // FAQ Accordion open index state
  const [openFaq, setOpenFaq] = useState(0)

  // Demo / Contact Modal state
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', role: 'Hospital Administrator', message: '' })
  const [contactSubmitted, setContactSubmitted] = useState(false)

  // Live vitals micro-fluctuations for the bedside card
  const [vitals, setVitals] = useState({
    hr: 74,
    spo2: 98,
    temp: 36.8
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setVitals({
        hr: Math.round(72 + Math.random() * 4),
        spo2: Math.min(100, Math.round(98 + Math.random() * 1)),
        temp: Number((36.7 + Math.random() * 0.2).toFixed(1))
      })
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  const scrollTo = id => {
    setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleContactSubmit = e => {
    e.preventDefault()
    setContactSubmitted(true)
    setTimeout(() => {
      setContactSubmitted(false)
      setContactModalOpen(false)
      setContactForm({ name: '', email: '', role: 'Hospital Administrator', message: '' })
    }, 2000)
  }

  const faqs = [
    {
      q: "How does continuous recovery monitoring work at home?",
      a: "Patients wear a lightweight, comfortable biosensor upon hospital discharge. It continuously measures pulse, blood oxygen, temperature, and mobility, automatically syncing with the clinical portal for doctor and family oversight."
    },
    {
      q: "What happens if an abnormal vital reading or fall occurs?",
      a: "The system automatically detects abnormal vital drifts and impact events. When a threshold is crossed, instant priority alerts are dispatched to the clinical team and designated family caregivers."
    },
    {
      q: "Is patient health information secure?",
      a: "Yes. PulseNet adheres to strict healthcare standards with end-to-end 256-bit encryption and HIPAA-aligned data privacy protocols for all telemetry and medical records."
    },
    {
      q: "Can family members access the platform?",
      a: "Yes. Family members have access to a dedicated Caregiver Portal to track recovery milestones, review medication schedules, and receive instant emergency notifications."
    },
    {
      q: "How do clinics and hospitals get started?",
      a: "Healthcare providers can register an institutional account in minutes or schedule an onboarding demo with our clinical team for full electronic health record integration."
    }
  ]

  return (
    <div className="landing-wrapper">
      {/* ── Navigation Bar (Header) ─────────────────────────────────── */}
      <nav className="landing-nav" aria-label="Main Navigation">
        <div className="landing-nav-container">
          <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="landing-brand-icon" aria-hidden="true">🫀</div>
            <div>
              <div className="landing-brand-title-wrap">
                <span className="landing-brand-text">PulseNet</span>
                <span className="landing-brand-tagline">Every Pulse Matters</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="landing-nav-links">
            <a href="#hero" className="landing-nav-link" onClick={e => { e.preventDefault(); scrollTo('hero') }}>Home</a>
            <a href="#features" className="landing-nav-link" onClick={e => { e.preventDefault(); scrollTo('features') }}>Features</a>
            <a href="#how-it-works" className="landing-nav-link" onClick={e => { e.preventDefault(); scrollTo('how-it-works') }}>How It Works</a>
            <a href="#about-us" className="landing-nav-link" onClick={e => { e.preventDefault(); scrollTo('about-us') }}>About Us</a>
            <a href="#reviews" className="landing-nav-link" onClick={e => { e.preventDefault(); scrollTo('reviews') }}>Reviews</a>
            <a href="#faq" className="landing-nav-link" onClick={e => { e.preventDefault(); scrollTo('faq') }}>FAQ</a>
          </div>

          {/* Navigation CTAs */}
          <div className="landing-nav-actions">
            {currentUser ? (
              <button
                className="btn-primary"
                onClick={() => navigate(currentUser.role === 'doctor' ? '/doctor' : '/patient')}
              >
                Go to {currentUser.role === 'doctor' ? 'Clinical' : 'Patient'} Portal →
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">
                  Sign In
                </Link>
                <button
                  className="btn-secondary"
                  onClick={() => setContactModalOpen(true)}
                >
                  Book Demo
                </button>
                <Link to="/signup" className="btn-primary">
                  Get Started <span aria-hidden="true">→</span>
                </Link>
              </>
            )}

            {/* Mobile Hamburger Button */}
            <button
              className="hamburger-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`} />
              <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`} />
              <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-nav-drawer" role="menu">
            <a href="#hero" className="mobile-nav-link" onClick={e => { e.preventDefault(); scrollTo('hero') }}>Home</a>
            <a href="#features" className="mobile-nav-link" onClick={e => { e.preventDefault(); scrollTo('features') }}>Features</a>
            <a href="#how-it-works" className="mobile-nav-link" onClick={e => { e.preventDefault(); scrollTo('how-it-works') }}>How It Works</a>
            <a href="#about-us" className="mobile-nav-link" onClick={e => { e.preventDefault(); scrollTo('about-us') }}>About Us</a>
            <a href="#reviews" className="mobile-nav-link" onClick={e => { e.preventDefault(); scrollTo('reviews') }}>Reviews</a>
            <a href="#faq" className="mobile-nav-link" onClick={e => { e.preventDefault(); scrollTo('faq') }}>FAQ</a>
            <div className="mobile-nav-actions">
              <Link to="/login" className="btn-ghost" style={{ justifyContent: 'center' }}>Sign In</Link>
              <Link to="/signup" className="btn-primary" style={{ justifyContent: 'center' }}>Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <header className="hero-section" id="hero">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-pill">
              <span className="hero-pill-dot" />
              PulseNet · Every Pulse Matters
            </div>

            <h1 className="hero-title">
              Safe Post-Operative Recovery, <br />
              <span className="hero-title-highlight">From Hospital to Home</span>
            </h1>

            <p className="hero-subtitle">
              PulseNet bridges hospital surgical care with home recovery through gentle 24/7 vital signs tracking, proactive early deterioration alerts, and seamless coordination between clinicians and families.
            </p>

            <div className="hero-cta-group">
              <Link to="/signup" className="btn-primary btn-large">
                Get Started Now <span aria-hidden="true">→</span>
              </Link>
              <button
                className="btn-secondary btn-large"
                onClick={() => setContactModalOpen(true)}
              >
                Book a Demo
              </button>
            </div>

            <div className="hero-trust-row">
              <span className="hero-trust-badge">
                <span className="trust-check">✓</span> 24/7 Continuous Care
              </span>
              <span className="hero-trust-badge">
                <span className="trust-check">✓</span> 256-Bit Encrypted
              </span>
              <span className="hero-trust-badge">
                <span className="trust-check">✓</span> HIPAA Aligned
              </span>
            </div>
          </div>

          {/* Clean, Simple Bedside Health Monitor Preview */}
          <div className="hero-visual">
            <div className="bedside-monitor-card">
              <div className="bedside-header">
                <div className="bedside-title-group">
                  <span className="bedside-live-dot" />
                  <div className="bedside-title">Live Health Telemetry</div>
                </div>
                <div className="bedside-status-pill">
                  <span>●</span> Normal
                </div>
              </div>

              <div className="bedside-vitals-grid">
                {/* Heart Rate */}
                <div className="bedside-metric-box green">
                  <div className="metric-box-head">
                    <span className="metric-box-name">Heart Rate</span>
                    <span className="metric-box-icon">❤️</span>
                  </div>
                  <div className="metric-box-value">
                    {vitals.hr} <span className="metric-box-unit">BPM</span>
                  </div>
                </div>

                {/* Blood Oxygen */}
                <div className="bedside-metric-box blue">
                  <div className="metric-box-head">
                    <span className="metric-box-name">Blood Oxygen</span>
                    <span className="metric-box-icon">🫁</span>
                  </div>
                  <div className="metric-box-value">
                    {vitals.spo2} <span className="metric-box-unit">%</span>
                  </div>
                </div>

                {/* Body Temperature */}
                <div className="bedside-metric-box amber">
                  <div className="metric-box-head">
                    <span className="metric-box-name">Body Temp</span>
                    <span className="metric-box-icon">🌡️</span>
                  </div>
                  <div className="metric-box-value">
                    {vitals.temp} <span className="metric-box-unit">°C</span>
                  </div>
                </div>

                {/* Patient Mobility */}
                <div className="bedside-metric-box purple">
                  <div className="metric-box-head">
                    <span className="metric-box-name">Activity Status</span>
                    <span className="metric-box-icon">🛡️</span>
                  </div>
                  <div className="metric-box-value metric-box-text">
                    Resting
                  </div>
                </div>
              </div>

              {/* Simple Safeguard Status */}
              <div className="bedside-safeguard-footer">
                <div className="safeguard-pill">
                  <span className="safeguard-icon">🛡️</span>
                  <span>Health Safeguard: <strong>Active &amp; Normal</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Statistics & Trust Indicators ────────────────────────────── */}
      <section className="landing-section stats-section" aria-label="Platform Statistics">
        <div className="stats-container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">24/7</div>
              <div className="stat-title">Continuous Monitoring</div>
              <div className="stat-desc">Uninterrupted vital signs tracking during post-op recovery</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">99.8%</div>
              <div className="stat-title">System Reliability</div>
              <div className="stat-desc">Dependable cloud infrastructure ensuring clinical data continuity</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">&lt; 1 sec</div>
              <div className="stat-title">Emergency Alert Speed</div>
              <div className="stat-desc">Rapid notification dispatch to clinicians and designated family</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">4.9 / 5</div>
              <div className="stat-title">Clinical Satisfaction</div>
              <div className="stat-desc">Rated for usability, patient safety, and peace of mind</div>
            </div>
          </div>

          <div className="trust-certifications-bar">
            <div className="cert-pill">
              <span className="cert-icon">🔒</span>
              <strong>HIPAA Aligned Privacy</strong>
            </div>
            <div className="cert-pill">
              <span className="cert-icon">🛡️</span>
              <strong>ISO 27001 Standards</strong>
            </div>
            <div className="cert-pill">
              <span className="cert-icon">🩺</span>
              <strong>Clinical Oversight</strong>
            </div>
            <div className="cert-pill">
              <span className="cert-icon">⚡</span>
              <strong>Live Telemetry Sync</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features and Services ─────────────────────────────────────── */}
      <section className="landing-section" id="features">
        <div className="section-head">
          <span className="section-pill">Core Features</span>
          <h2 className="section-title">Comprehensive Health Monitoring</h2>
          <p className="section-desc">
            Essential care tools designed to support surgeons, recovering patients, and family caregivers.
          </p>
        </div>

        <div className="features-grid">
          {/* Feature 1 */}
          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
              ❤️
            </div>
            <h3 className="feature-title">Continuous Vital Signs</h3>
            <p className="feature-desc">
              Non-invasive, around-the-clock tracking of heart rate, oxygen saturation, and body temperature trends.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: '#fef2f2', color: '#dc2626' }}>
              🚨
            </div>
            <h3 className="feature-title">Early Deterioration Alerts</h3>
            <p className="feature-desc">
              Automated clinical baseline algorithms detect gradual vital signs drift before complications escalate.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              🛡️
            </div>
            <h3 className="feature-title">Fall &amp; Mobility Safeguard</h3>
            <p className="feature-desc">
              Kinetic motion tracking identifies unexpected stumbles or impact falls, triggering instant notifications.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
              📋
            </div>
            <h3 className="feature-title">Recovery Pathways</h3>
            <p className="feature-desc">
              Personalized post-surgery care journeys with daily rehabilitation milestones and wound care prompts.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: '#fffbeb', color: '#d97706' }}>
              💊
            </div>
            <h3 className="feature-title">Medication Adherence</h3>
            <p className="feature-desc">
              Automated dosage schedules and reminders ensure recovering patients take prescriptions on time.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: '#f0fdfa', color: '#0d9488' }}>
              💬
            </div>
            <h3 className="feature-title">Caregiver Coordination</h3>
            <p className="feature-desc">
              Secure in-app messaging connecting recovering patients and families directly with clinical care staff.
            </p>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <section className="landing-section bg-subtle" id="how-it-works">
        <div className="section-head">
          <span className="section-pill">Simple Workflow</span>
          <h2 className="section-title">How PulseNet Works</h2>
          <p className="section-desc">
            A simple, four-step care continuum designed for seamless adoption.
          </p>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-badge">1</div>
            <div className="step-icon-circle">⌚</div>
            <h3 className="step-title">Wear the Sensor</h3>
            <p className="step-desc">
              Comfortable, lightweight wearable continuously measures vital signs without wires.
            </p>
          </div>

          <div className="step-arrow" aria-hidden="true">➔</div>

          <div className="step-card">
            <div className="step-badge">2</div>
            <div className="step-icon-circle">🔄</div>
            <h3 className="step-title">Automatic Sync</h3>
            <p className="step-desc">
              Health signals stream securely to the clinical platform in real time.
            </p>
          </div>

          <div className="step-arrow" aria-hidden="true">➔</div>

          <div className="step-card">
            <div className="step-badge">3</div>
            <div className="step-icon-circle">👨‍⚕️</div>
            <h3 className="step-title">Doctor Oversight</h3>
            <p className="step-desc">
              Physicians monitor recovery stability and progression through the clinical portal.
            </p>
          </div>

          <div className="step-arrow" aria-hidden="true">➔</div>

          <div className="step-card">
            <div className="step-badge">4</div>
            <div className="step-icon-circle">🔔</div>
            <h3 className="step-title">Rapid Support</h3>
            <p className="step-desc">
              Immediate alerts notify clinicians and families if urgent care is required.
            </p>
          </div>
        </div>
      </section>

      {/* ── About Us Section ─────────────────────────────────────────── */}
      <section className="landing-section" id="about-us">
        <div className="section-head">
          <span className="section-pill">About Us</span>
          <h2 className="section-title">Safer, Connected Home Recovery</h2>
          <p className="section-desc">
            PulseNet bridges the critical gap between hospital discharge and full recovery at home.
          </p>
        </div>

        <div className="about-grid">
          <div className="about-narrative-card">
            <h3 className="about-card-title">Our Purpose</h3>
            <p className="about-text">
              The most vulnerable phase of surgery begins the moment a patient leaves the hospital. In-hospital vital checks often drop to occasional self-reports, leaving subtle complications undetected until readmission is unavoidable.
            </p>
            <p className="about-text">
              PulseNet provides non-invasive continuous monitoring paired with intelligent clinical trend evaluation, empowering surgical teams to oversee patient recovery in the home just as attentively as in the ward.
            </p>
          </div>

          <div className="about-pillars-column">
            <div className="pillar-card">
              <div className="pillar-icon">🎯</div>
              <div>
                <h4 className="pillar-title">Our Mission</h4>
                <p className="pillar-desc">
                  Eliminate post-discharge complications and reduce preventable hospital readmissions.
                </p>
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">🌟</div>
              <div>
                <h4 className="pillar-title">Our Vision</h4>
                <p className="pillar-desc">
                  A connected healthcare ecosystem where every patient recovers with total confidence.
                </p>
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">🤝</div>
              <div>
                <h4 className="pillar-title">Our Values</h4>
                <p className="pillar-desc">
                  Patient safety first, clinical excellence, data privacy, and compassionate support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials and Reviews ─────────────────────────────────── */}
      <section className="landing-section bg-subtle" id="reviews">
        <div className="section-head">
          <span className="section-pill">Feedback</span>
          <h2 className="section-title">Trusted by Care Teams &amp; Families</h2>
          <p className="section-desc">
            How continuous recovery monitoring supports patient safety across hospitals and homes.
          </p>
        </div>

        <div className="reviews-grid">
          {/* Review 1 */}
          <div className="review-card">
            <div className="review-stars" aria-label="5 out of 5 stars">★★★★★</div>
            <p className="review-quote">
              "PulseNet has enhanced our post-surgical discharge protocol. Continuous vital trends allow us to intervene early if signs of infection or distress arise."
            </p>
            <div className="review-author">
              <div className="author-avatar">👩‍⚕️</div>
              <div>
                <div className="author-name">Orthopedic Surgical Lead</div>
                <div className="author-role">Regional Healthcare Network</div>
              </div>
            </div>
          </div>

          {/* Review 2 */}
          <div className="review-card">
            <div className="review-stars" aria-label="5 out of 5 stars">★★★★★</div>
            <p className="review-quote">
              "Recovering at home after surgery felt completely secure. Knowing my doctor was reviewing my vital signs every day gave my family tremendous peace of mind."
            </p>
            <div className="review-author">
              <div className="author-avatar" style={{ background: '#059669' }}>👨‍💼</div>
              <div>
                <div className="author-name">Recovering Patient</div>
                <div className="author-role">Post-Operative Home Recovery</div>
              </div>
            </div>
          </div>

          {/* Review 3 */}
          <div className="review-card">
            <div className="review-stars" aria-label="5 out of 5 stars">★★★★★</div>
            <p className="review-quote">
              "Managing home recovery was so much easier. The medication reminders and instant alerts kept our entire family informed and reassured."
            </p>
            <div className="review-author">
              <div className="author-avatar" style={{ background: '#7c3aed' }}>👩</div>
              <div>
                <div className="author-name">Designated Family Caregiver</div>
                <div className="author-role">Home Care Support</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Frequently Asked Questions (FAQ) ─────────────────────────── */}
      <section className="landing-section" id="faq">
        <div className="section-head">
          <span className="section-pill">FAQ</span>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-desc">
            Quick answers about our continuous recovery platform and patient safety.
          </p>
        </div>

        <div className="faq-accordion-wrap">
          {faqs.map((item, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={idx}
                className={`faq-item ${isOpen ? 'active' : ''}`}
                onClick={() => setOpenFaq(isOpen ? -1 : idx)}
              >
                <button
                  className="faq-question-btn"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span className="faq-question-text">{item.q}</span>
                  <span className="faq-icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="faq-answer-body" id={`faq-answer-${idx}`}>
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Final Call-to-Action Section ────────────────────────────── */}
      <section className="final-cta-section" aria-label="Final Call to Action">
        <div className="final-cta-container">
          <span className="cta-pill">Get Started</span>
          <h2 className="final-cta-title">
            Elevate Post-Operative Patient Care Today
          </h2>
          <p className="final-cta-desc">
            Empower your clinical teams with continuous patient insights and provide recovering individuals the reassuring care they deserve.
          </p>

          <div className="final-cta-buttons">
            <Link to="/signup" className="btn-primary btn-large">
              Create Free Account <span aria-hidden="true">→</span>
            </Link>
            <button
              className="btn-secondary btn-large"
              onClick={() => setContactModalOpen(true)}
            >
              Request a Demo
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="landing-footer" role="contentinfo">
        <div className="landing-footer-container">
          <div className="landing-footer-top">
            <div className="footer-brand-info">
              <div className="landing-brand">
                <div className="landing-brand-icon" aria-hidden="true">🫀</div>
                <div>
                  <div className="landing-brand-text" style={{ color: '#ffffff' }}>PulseNet</div>
                  <div style={{ fontSize: 12, color: 'var(--primary-border, #bfdbfe)', fontWeight: 500 }}>Every Pulse Matters</div>
                </div>
              </div>
              <p className="footer-desc">
                Continuous patient health telemetry and post-treatment recovery monitoring platform providing clinical vigilance, early health alerts, and caregiver support.
              </p>
            </div>

            <div className="footer-links-grid">
              <div className="footer-links-col">
                <div className="footer-col-title">Navigation</div>
                <a href="#hero" className="footer-link" onClick={e => { e.preventDefault(); scrollTo('hero') }}>Home</a>
                <a href="#features" className="footer-link" onClick={e => { e.preventDefault(); scrollTo('features') }}>Features</a>
                <a href="#how-it-works" className="footer-link" onClick={e => { e.preventDefault(); scrollTo('how-it-works') }}>How It Works</a>
                <a href="#about-us" className="footer-link" onClick={e => { e.preventDefault(); scrollTo('about-us') }}>About Us</a>
              </div>

              <div className="footer-links-col">
                <div className="footer-col-title">Care Portals</div>
                <Link to="/login" className="footer-link">Clinician Portal</Link>
                <Link to="/login" className="footer-link">Patient Recovery</Link>
                <Link to="/signup" className="footer-link">Create Account</Link>
              </div>

              <div className="footer-links-col">
                <div className="footer-col-title">Support</div>
                <span className="footer-contact-item">support@pulsenet-health.org</span>
                <span className="footer-contact-item">24/7 Clinical Telemetry Active</span>
              </div>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <div>
              © 2026 PulseNet Platform · Every Pulse Matters · All clinical rights reserved.
            </div>
            <div className="footer-status-indicator">
              <span className="footer-status-dot" />
              <span>All Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Demo / Contact Modal ────────────────────────────────────────── */}
      {contactModalOpen && (
        <div className="modal-backdrop" onClick={() => setContactModalOpen(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-icon">🩺</div>
                <div>
                  <h3 className="modal-title" id="modal-title">Request a Consultation or Demo</h3>
                  <p className="modal-sub">Learn how PulseNet protects patients during home recovery. Every Pulse Matters.</p>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setContactModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {contactSubmitted ? (
              <div className="modal-success-message">
                <div className="success-icon">✓</div>
                <h4>Thank you!</h4>
                <p>Our clinical team has received your request and will reach out shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="modal-form">
                <div className="form-group">
                  <label htmlFor="contact-name">Full Name</label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    placeholder="e.g. Dr. Jennifer Lawrence"
                    value={contactForm.name}
                    onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contact-email">Email</label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    placeholder="name@hospital.org"
                    value={contactForm.email}
                    onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contact-role">Role or Organization</label>
                  <select
                    id="contact-role"
                    value={contactForm.role}
                    onChange={e => setContactForm({ ...contactForm, role: e.target.value })}
                  >
                    <option value="Surgeon / Physician">Surgeon / Physician</option>
                    <option value="Hospital Administrator">Hospital Administrator</option>
                    <option value="Nursing / Ward Lead">Nursing / Ward Lead</option>
                    <option value="Home Health Care Provider">Home Health Care Provider</option>
                    <option value="Patient or Family Member">Patient or Family Member</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="contact-message">Message (Optional)</label>
                  <textarea
                    id="contact-message"
                    rows="3"
                    placeholder="How can we help your team?"
                    value={contactForm.message}
                    onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setContactModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

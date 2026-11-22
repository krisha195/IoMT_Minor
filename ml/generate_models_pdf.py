import os
import subprocess
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_PDF = os.path.join(BASE_DIR, "PulseNet_AI_Models_Comprehensive_Specification.pdf")
TEMP_HTML = os.path.join(BASE_DIR, "PulseNet_Models_Doc.html")

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe")
]

def find_browser():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    return None

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PulseNet AI Models & Clinical Intelligence Technical Specification</title>
<style>
  @page {
    size: A4 portrait;
    margin: 16mm 14mm 16mm 14mm;
    @bottom-right {
      content: "Page " counter(page);
      font-size: 8pt;
      color: #64748b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.55;
    font-size: 9.5pt;
    margin: 0;
    padding: 0;
    background: #ffffff;
  }

  /* Document Header / Cover Banner */
  .doc-header {
    border-bottom: 2px solid #2563eb;
    padding-bottom: 14px;
    margin-bottom: 22px;
  }

  .doc-badge-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .brand-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #eff6ff;
    color: #1d4ed8;
    padding: 4px 12px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 8.5pt;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    border: 1px solid #bfdbfe;
  }

  .doc-meta-right {
    font-size: 8.5pt;
    color: #64748b;
    font-weight: 500;
  }

  .doc-title {
    font-size: 22pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.2;
    margin: 6px 0 6px 0;
  }

  .doc-subtitle {
    font-size: 11pt;
    color: #475569;
    font-weight: 400;
    margin: 0 0 10px 0;
    line-height: 1.4;
  }

  .header-details-strip {
    display: flex;
    gap: 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 8pt;
    color: #475569;
  }

  .header-details-strip strong {
    color: #0f172a;
  }

  /* Section Styling */
  .section-block {
    margin-bottom: 22px;
    page-break-inside: auto;
  }

  .page-break {
    page-break-before: always;
  }

  .avoid-break {
    page-break-inside: avoid;
  }

  h2 {
    font-size: 13.5pt;
    font-weight: 700;
    color: #0f172a;
    border-left: 4px solid #2563eb;
    padding-left: 10px;
    margin: 18px 0 10px 0;
    line-height: 1.25;
  }

  h3 {
    font-size: 11pt;
    font-weight: 600;
    color: #1e293b;
    margin: 14px 0 6px 0;
  }

  h4 {
    font-size: 9.5pt;
    font-weight: 600;
    color: #334155;
    margin: 10px 0 4px 0;
  }

  p {
    margin: 0 0 8px 0;
    text-align: justify;
  }

  /* Callout Boxes */
  .callout {
    border-radius: 6px;
    padding: 10px 14px;
    margin: 10px 0;
    font-size: 8.5pt;
    border-left: 4px solid;
    page-break-inside: avoid;
  }

  .callout-blue {
    background: #eff6ff;
    border-color: #2563eb;
    color: #1e3a8a;
  }

  .callout-amber {
    background: #fffbeb;
    border-color: #d97706;
    color: #78350f;
  }

  .callout-red {
    background: #fef2f2;
    border-color: #dc2626;
    color: #7f1d1d;
  }

  .callout-green {
    background: #f0fdf4;
    border-color: #16a34a;
    color: #14532d;
  }

  .callout-title {
    font-weight: 700;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 8.2pt;
    page-break-inside: avoid;
  }

  th, td {
    padding: 6px 9px;
    border: 1px solid #cbd5e1;
    text-align: left;
  }

  th {
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
  }

  tr:nth-child(even) {
    background: #f8fafc;
  }

  /* Key Value Grid */
  .kv-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin: 10px 0;
    page-break-inside: avoid;
  }

  .kv-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
  }

  .kv-label {
    font-size: 7.5pt;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 700;
    margin-bottom: 2px;
  }

  .kv-value {
    font-size: 9.5pt;
    color: #0f172a;
    font-weight: 600;
  }

  .kv-desc {
    font-size: 8pt;
    color: #475569;
    margin-top: 2px;
  }

  /* Formula display */
  .formula-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 14px;
    font-family: "Courier New", Courier, monospace;
    font-size: 9pt;
    color: #0f172a;
    text-align: center;
    margin: 8px 0;
    page-break-inside: avoid;
  }

  /* Diagram container */
  .diagram-container {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    margin: 12px 0;
    text-align: center;
    page-break-inside: avoid;
  }

  .diagram-caption {
    font-size: 7.5pt;
    color: #64748b;
    font-weight: 600;
    margin-top: 6px;
    text-align: center;
  }

  /* Badge labels */
  .tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .tag-green { background: #dcfce7; color: #15803d; }
  .tag-amber { background: #fef3c7; color: #b45309; }
  .tag-red { background: #fee2e2; color: #b91c1c; }
  .tag-blue { background: #dbeafe; color: #1d4ed8; }

  ul, ol {
    margin: 4px 0 10px 18px;
    padding: 0;
  }

  li {
    margin-bottom: 4px;
  }

  .footer-note {
    font-size: 7.5pt;
    color: #94a3b8;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
    margin-top: 20px;
  }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- COVER / DOCUMENT HEADER                                                -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<header class="doc-header">
  <div class="doc-badge-row">
    <div class="brand-pill">
      <span>🫀</span> PulseNet Platform Technical Specification
    </div>
    <div class="doc-meta-right">
      Doc ID: <strong>PN-AI-ENG-2026-V2</strong> · Classification: <strong>Medical AI Engineering</strong>
    </div>
  </div>

  <h1 class="doc-title">AI Machine Learning Models & Clinical Intelligence Specification</h1>
  <p class="doc-subtitle">
    Comprehensive Reference Manual for Continuous Vital Signs Anomaly Detection, Wearable Fall Kinetic Intelligence, Physiological Parameter Coupling, SisFall Benchmarks, Data Preprocessing Pipelines, and Multi-Tiered Alert Systems.
  </p>

  <div class="header-details-strip">
    <div>Platform: <strong>PulseNet ("Every Pulse Matters")</strong></div>
    <div>Target: <strong>Post-Operative Hospital-to-Home Care</strong></div>
    <div>Models: <strong>Transformer/LSTM-AE & Multi-Scale CNN-BiLSTM</strong></div>
    <div>Date: <strong>November 2026</strong></div>
  </div>
</header>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 1: EXECUTIVE SYSTEM ARCHITECTURE                               -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="section-block">
  <h2>1. Executive Architectural Overview & Clinical Purpose</h2>
  <p>
    <strong>PulseNet</strong> is an intelligent post-operative remote patient surveillance and clinical decision support system. Its primary mission is to eliminate the dangerous "monitoring void" that occurs between hospital discharge and full home convalescence. Post-surgical patients frequently experience subtle, undetected pathophysiological decline—such as emerging surgical site sepsis, micro-embolic pulmonary compromise, internal fluid shifts, or unobserved physical collapses—that standard intermittent checkups fail to capture until emergency readmission is unavoidable.
  </p>
  <p>
    To resolve this challenge with high clinical fidelity, PulseNet deploys a <strong>dual-engine machine learning architecture</strong> operating concurrently on real-time physiological telemetry:
  </p>

  <div class="kv-grid">
    <div class="kv-card" style="border-left: 3px solid #2563eb;">
      <div class="kv-label">Engine 1 · Vitals Intelligence</div>
      <div class="kv-value">Transformer / LSTM Autoencoder</div>
      <div class="kv-desc">Continuous, unsupervised multivariate sequence reconstruction of Heart Rate, SpO2, and Core Body Temperature. Detects early deterioration signatures before any single metric crosses a rigid hospital threshold.</div>
    </div>
    <div class="kv-card" style="border-left: 3px solid #7c3aed;">
      <div class="kv-label">Engine 2 · Kinetic Sentinel</div>
      <div class="kv-value">Multi-Scale CNN-BiLSTM with Attention</div>
      <div class="kv-desc">High-frequency tri-axial accelerometer and gyroscope kinetic analysis. Identifies the tri-phasic signature of human falls (Freefall → Impact Collision → Post-Fall Inactivity) while filtering daily activities.</div>
    </div>
  </div>

  <div class="diagram-container">
    <svg width="680" height="150" viewBox="0 0 680 150" xmlns="http://www.w3.org/2000/svg">
      <!-- Wearable Node -->
      <rect x="10" y="25" width="130" height="100" rx="8" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="75" y="48" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">Wearable Biosensor</text>
      <text x="75" y="68" font-size="8.5" fill="#475569" text-anchor="middle">PPG (HR, SpO2)</text>
      <text x="75" y="83" font-size="8.5" fill="#475569" text-anchor="middle">Body Temp Sensor</text>
      <text x="75" y="98" font-size="8.5" fill="#475569" text-anchor="middle">6-Axis IMU (Acc+Gyr)</text>
      <text x="75" y="113" font-size="8" fill="#2563eb" text-anchor="middle">200 Hz / 1 Hz Streams</text>

      <!-- Arrow 1 -->
      <path d="M 140 75 L 185 75" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)"/>
      <text x="162" y="68" font-size="7.5" fill="#64748b" text-anchor="middle">BLE / Wi-Fi</text>

      <!-- Backend Preprocessor & Buffers -->
      <rect x="190" y="25" width="140" height="100" rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"/>
      <text x="260" y="48" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle">FastAPI Backend</text>
      <text x="260" y="68" font-size="8.5" fill="#475569" text-anchor="middle">Physical Unit Conversion</text>
      <text x="260" y="83" font-size="8.5" fill="#475569" text-anchor="middle">FIFO Buffer Sliding Win</text>
      <text x="260" y="98" font-size="8.5" fill="#475569" text-anchor="middle">StandardScaler Normalization</text>
      <text x="260" y="113" font-size="8" fill="#059669" text-anchor="middle">1.8g Dynamic Pre-Filter</text>

      <!-- Forking Arrows -->
      <path d="M 330 60 L 375 45" stroke="#2563eb" stroke-width="2"/>
      <path d="M 330 90 L 375 105" stroke="#7c3aed" stroke-width="2"/>

      <!-- ML Models Box -->
      <rect x="380" y="15" width="145" height="55" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
      <text x="452" y="36" font-size="9.5" font-weight="bold" fill="#1d4ed8" text-anchor="middle">Vitals Transformer</text>
      <text x="452" y="52" font-size="8" fill="#475569" text-anchor="middle">Latent MSE Anomaly Engine</text>

      <rect x="380" y="80" width="145" height="55" rx="6" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/>
      <text x="452" y="101" font-size="9.5" font-weight="bold" fill="#6d28d9" text-anchor="middle">Fall CNN-BiLSTM</text>
      <text x="452" y="117" font-size="8" fill="#475569" text-anchor="middle">Multi-Scale Temporal Attention</text>

      <!-- Convergence Arrows -->
      <path d="M 525 42 L 565 65" stroke="#2563eb" stroke-width="1.5"/>
      <path d="M 525 107 L 565 85" stroke="#7c3aed" stroke-width="1.5"/>

      <!-- Clinical Synthesis & Alert -->
      <rect x="570" y="25" width="100" height="100" rx="8" fill="#fef2f2" stroke="#dc2626" stroke-width="1.5"/>
      <text x="620" y="50" font-size="10" font-weight="bold" fill="#991b1b" text-anchor="middle">Decision Engine</text>
      <text x="620" y="70" font-size="8" fill="#475569" text-anchor="middle">NEWS2 Score</text>
      <text x="620" y="85" font-size="8" fill="#475569" text-anchor="middle">Multi-Tier Alert</text>
      <text x="620" y="105" font-size="8" font-weight="bold" fill="#dc2626" text-anchor="middle">SMS / Push / Red</text>

      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
        </marker>
      </defs>
    </svg>
    <div class="diagram-caption">Figure 1.1: Complete End-to-End PulseNet Edge-to-Cloud Telemetry & Machine Learning Architecture.</div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 2: PHYSIOLOGICAL INTER-VITAL COUPLING                          -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="section-block avoid-break">
  <h2>2. Physiological Inter-Vital Coupling & Clinical Decision Logic</h2>
  <p>
    A critical flaw in conventional vital sign monitors is the <em>siloed treatment</em> of biomarkers: evaluating Heart Rate, SpO2, and Temperature independently against static upper/lower bounds. In human physiology, vital parameters do not operate in isolation; they are deeply coupled biological feedback circuits governed by the autonomic nervous system, cardiopulmonary gas exchange, and systemic thermoregulation.
  </p>

  <h3>2.1 The Biological Coupling Loops</h3>
  <ul>
    <li>
      <strong>The Cardiopulmonary Compensation Loop ($SpO_2 \leftrightarrow HR$):</strong> Systemic oxygen delivery is defined mathematically as $DO_2 = CO \times CaO_2$, where $CO = HR \times SV$ (cardiac output) and $CaO_2 \approx 1.34 \times [Hb] \times SpO_2$. When micro-atelectasis, pneumonia, or pulmonary embolism causes arterial oxygenation ($SpO_2$) to drop, peripheral carotid and aortic chemoreceptors fire rapidly. The sympathetic nervous system responds with reflex <em>compensatory tachycardia</em> (elevated HR) to preserve tissue perfusion. If $SpO_2$ falls while HR fails to rise (or collapses into bradycardia), it signals cardiovascular exhaustion and imminent fatal arrest.
    </li>
    <li>
      <strong>The Sepsis & Systemic Inflammatory Cascade ($Temp \leftrightarrow HR \leftrightarrow SpO_2$):</strong> Bacterial endotoxins and inflammatory cytokines (IL-1, IL-6, TNF-$\alpha$) elevate the hypothalamic thermal set-point, producing fever ($>38.0^\circ\text{C}$) or paradoxical hypothermia ($<36.0^\circ\text{C}$). For every $1^\circ\text{C}$ elevation in core body temperature, basal metabolic demand rises by approximately $10\%-13\%$, mandating an increase in heart rate ($\approx +10\text{ BPM}/^\circ\text{C}$) and accelerated cellular oxygen consumption, causing peripheral $SpO_2$ to drift downward.
    </li>
    <li>
      <strong>Kinetic Shock & Autonomic Tone ($Fall \leftrightarrow HR \leftrightarrow Temp$):</strong> An impact fall induces acute neuroendocrine sympathetic discharge, driving instant sinus tachycardia and tachypnea. Conversely, if a fall occurs during motionless vasovagal syncope or complete heart block, heart rate collapses to $<40\text{ BPM}$ prior to impact. Furthermore, if a fallen patient cannot rise ("long-lie" $>1\text{ hour}$), core temperature steadily drops toward environmental hypothermia, accompanied by rhabdomyolysis and acute kidney injury.
    </li>
  </ul>

  <div class="diagram-container">
    <svg width="680" height="150" viewBox="0 0 680 150" xmlns="http://www.w3.org/2000/svg">
      <!-- SpO2 Circle -->
      <circle cx="120" cy="75" r="50" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
      <text x="120" y="65" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">Blood Oxygen</text>
      <text x="120" y="80" font-size="12" font-weight="bold" fill="#2563eb" text-anchor="middle">SpO₂ (%)</text>
      <text x="120" y="95" font-size="7.5" fill="#64748b" text-anchor="middle">Gas Exchange</text>

      <!-- Heart Rate Circle -->
      <circle cx="340" cy="75" r="50" fill="#fef2f2" stroke="#dc2626" stroke-width="2"/>
      <text x="340" y="65" font-size="11" font-weight="bold" fill="#991b1b" text-anchor="middle">Pulse Rate</text>
      <text x="340" y="80" font-size="12" font-weight="bold" fill="#dc2626" text-anchor="middle">HR (BPM)</text>
      <text x="340" y="95" font-size="7.5" fill="#64748b" text-anchor="middle">Cardiac Perfusion</text>

      <!-- Temperature Circle -->
      <circle cx="560" cy="75" r="50" fill="#fffbeb" stroke="#d97706" stroke-width="2"/>
      <text x="560" y="65" font-size="11" font-weight="bold" fill="#92400e" text-anchor="middle">Body Temp</text>
      <text x="560" y="80" font-size="12" font-weight="bold" fill="#d97706" text-anchor="middle">Temp (°C)</text>
      <text x="560" y="95" font-size="7.5" fill="#64748b" text-anchor="middle">Metabolic Index</text>

      <!-- Connecting Dual Arrows with Labels -->
      <path d="M 170 65 L 290 65" stroke="#2563eb" stroke-width="1.8" marker-end="url(#arrow-blue)"/>
      <text x="230" y="55" font-size="7.5" font-weight="bold" fill="#1e40af" text-anchor="middle">Hypoxia Triggers Tachycardia</text>

      <path d="M 290 85 L 170 85" stroke="#dc2626" stroke-width="1.8" marker-end="url(#arrow-red)"/>
      <text x="230" y="100" font-size="7.5" font-weight="bold" fill="#991b1b" text-anchor="middle">Cardiac Output Maintains DO₂</text>

      <path d="M 390 65 L 510 65" stroke="#dc2626" stroke-width="1.8" marker-end="url(#arrow-red)"/>
      <text x="450" y="55" font-size="7.5" font-weight="bold" fill="#991b1b" text-anchor="middle">Fever Drives Metabolic Rate (+10 BPM/°C)</text>

      <path d="M 510 85 L 390 85" stroke="#d97706" stroke-width="1.8" marker-end="url(#arrow-amber)"/>
      <text x="450" y="100" font-size="7.5" font-weight="bold" fill="#92400e" text-anchor="middle">Hypothermia Induces Bradycardia</text>

      <defs>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb"/>
        </marker>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626"/>
        </marker>
        <marker id="arrow-amber" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#d97706"/>
        </marker>
      </defs>
    </svg>
    <div class="diagram-caption">Figure 2.1: Tri-Directional Physiological Coupling Circuit Governing PulseNet Decision Logic.</div>
  </div>

  <h3>2.2 Multi-Tier Clinical Alert Escalation Engine</h3>
  <p>
    PulseNet integrates machine learning anomaly scores with standardized clinical risk guidelines (National Early Warning Score 2 / NEWS2) to classify patient status into actionable priority tiers:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 14%;">Care Status</th>
        <th style="width: 20%;">Vitals ML Anomaly ($\mathcal{L}_{\text{MSE}}$)</th>
        <th style="width: 22%;">Kinetic IMU Sentinel</th>
        <th style="width: 20%;">Clinical Presentation</th>
        <th style="width: 24%;">Automated Dispatch Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="tag tag-green">Nominal Recovery</span></td>
        <td>$\mathcal{L}_{\text{MSE}} \le \text{Threshold}$ (Reconstruction healthy)</td>
        <td>Impact $< 1.8g$, normal activity</td>
        <td>Stable vitals, physiological balance maintained</td>
        <td>Routine ward/caregiver dashboard refresh (15 min log cycle)</td>
      </tr>
      <tr>
        <td><span class="tag tag-amber">Subclinical Drift</span></td>
        <td>$\mathcal{L}_{\text{MSE}} > \text{Threshold}$ (subtle co-variation)</td>
        <td>Normal posture ($a_z \approx 1g$)</td>
        <td>Early sepsis onset, compensatory tachycardia, or silent hypoxia</td>
        <td>Telemetry warning banner, check sensor attachment, notify ward nurse</td>
      </tr>
      <tr>
        <td><span class="tag tag-red">Acute Impact Fall</span></td>
        <td>Variable (instant adrenergic tachycardia)</td>
        <td>Impact $> 2.0g$, $P_{\text{fall}} > 0.75$, Posture horizontal</td>
        <td>Unwitnessed fall, trip, stumble, or syncopal drop</td>
        <td>Instant audio beacon, SMS alert to family & ward, automated emergency dispatch</td>
      </tr>
      <tr>
        <td><span class="tag tag-red">Compound Distress</span></td>
        <td>$\mathcal{L}_{\text{MSE}} \gg \text{Threshold}$ (Severe anomaly)</td>
        <td>Fall confirmed + Motionless $> 30\text{s}$</td>
        <td>Loss of consciousness, shock, arrest following traumatic fall</td>
        <td>Emergency Code Blue escalation, immediate ambulance dispatch with GPS</td>
      </tr>
    </tbody>
  </table>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 3: MODEL 1 - VITALS ANOMALY RECONSTRUCTION                     -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="section-block page-break">
  <h2>3. Model 1: Continuous Vital Signs Anomaly Detection Engine</h2>
  
  <h3>3.1 The "Why": Reconstruction Latent Modeling vs Threshold Cutoffs</h3>
  <p>
    Traditional bedside patient monitors rely on scalar thresholds (e.g., alert if $\text{HR} > 100\text{ BPM}$ or $\text{SpO}_2 < 90\%$). This approach suffers from two severe clinical failures:
  </p>
  <ol>
    <li>
      <strong>Delayed Alarm Latency:</strong> In early sepsis or internal hemorrhage, a patient's heart rate might steadily rise from 68 to 96 BPM while SpO2 gradually ticks down from 99% to 92%. Because both remain technically inside "normal" bounds ($60-100\text{ BPM}$ and $\ge 90\%$), conventional monitors remain silent until full hemodynamic decompensation occurs.
    </li>
    <li>
      <strong>Alarm Fatigue:</strong> Isolated momentary sensor artifacts (e.g., patient moving a finger, causing a 1-second drop to 88% SpO2) trigger false alarms, leading hospital staff to desensitize or disable alert speakers.
    </li>
  </ol>
  <p>
    <strong>The PulseNet Solution:</strong> Train an unsupervised deep neural network (Transformer Encoder / Bidirectional LSTM Autoencoder) exclusively on healthy physiological sequences. The network learns the multi-dimensional manifold of normal vital sign co-dynamics. When confronted with pathological drift or erratic sensor failure, the model fails to reconstruct the aberrant sequence accurately. The resulting <strong>Reconstruction Mean Squared Error ($\mathcal{L}_{\text{MSE}}$)</strong> serves as a continuous, mathematically rigorous deterioration index.
  </p>

  <h3>3.2 Mathematical Formulation & Latent Bottleneck</h3>
  <p>
    Let $\mathbf{X} \in \mathbb{R}^{T \times C}$ denote a continuous sliding window of vital signs, where $T=30$ timesteps ($30\text{ seconds}$ at $1\text{ Hz}$) and $C=3$ channels (Heart Rate, SpO2, Body Temperature):
  </p>
  <div class="formula-box">
    $\mathbf{X} = [\mathbf{x}_1, \mathbf{x}_2, \dots, \mathbf{x}_{30}]^T, \quad \text{where } \mathbf{x}_t = [HR_t, SpO_{2,t}, Temp_t]$
  </div>
  <p>
    The Autoencoder architecture comprises an <strong>Encoder</strong> function $f_\theta(\mathbf{X})$ mapping the 90-dimensional sequence into a low-dimensional bottleneck representation $\mathbf{z} \in \mathbb{R}^{16}$, and a <strong>Decoder</strong> function $g_\phi(\mathbf{z})$ reconstructing the original sequence:
  </p>
  <div class="formula-box">
    $\mathbf{z} = \text{Encoder}(\mathbf{X}) \in \mathbb{R}^{16}, \qquad \hat{\mathbf{X}} = \text{Decoder}(\mathbf{z}) \in \mathbb{R}^{30 \times 3}$
  </div>
  <p>
    The model is optimized via Adam with Mean Squared Error loss across all normalized channels:
  </p>
  <div class="formula-box">
    $\mathcal{L}_{\text{MSE}}(\mathbf{X}, \hat{\mathbf{X}}) = \frac{1}{T \cdot C} \sum_{t=1}^T \sum_{c=1}^C \left( x_{t,c} - \hat{x}_{t,c} \right)^2$
  </div>

  <div class="diagram-container">
    <svg width="680" height="135" viewBox="0 0 680 135" xmlns="http://www.w3.org/2000/svg">
      <!-- Input Tensor -->
      <rect x="15" y="20" width="100" height="85" rx="6" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="65" y="45" font-size="9" font-weight="bold" fill="#1e40af" text-anchor="middle">Input Sequence X</text>
      <text x="65" y="65" font-size="8" fill="#475569" text-anchor="middle">Shape: (30, 3)</text>
      <text x="65" y="80" font-size="7.5" fill="#2563eb" text-anchor="middle">HR, SpO2, Temp</text>
      <text x="65" y="93" font-size="7.5" fill="#64748b" text-anchor="middle">30s Rolling Win</text>

      <!-- Encoder -->
      <path d="M 120 62 L 160 62" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
      <polygon points="165,15 255,35 255,90 165,110" fill="#f1f5f9" stroke="#475569" stroke-width="1.5"/>
      <text x="210" y="58" font-size="9" font-weight="bold" fill="#0f172a" text-anchor="middle">Encoder</text>
      <text x="210" y="73" font-size="7.5" fill="#64748b" text-anchor="middle">LSTM / Transf</text>

      <!-- Latent Bottleneck -->
      <path d="M 260 62 L 295 62" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
      <rect x="300" y="35" width="55" height="55" rx="4" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
      <text x="327" y="58" font-size="8.5" font-weight="bold" fill="#92400e" text-anchor="middle">Latent</text>
      <text x="327" y="73" font-size="8" fill="#b45309" text-anchor="middle">z ∈ ℝ¹⁶</text>

      <!-- Decoder -->
      <path d="M 360 62 L 395 62" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
      <polygon points="400,35 490,15 490,110 400,90" fill="#f1f5f9" stroke="#475569" stroke-width="1.5"/>
      <text x="445" y="58" font-size="9" font-weight="bold" fill="#0f172a" text-anchor="middle">Decoder</text>
      <text x="445" y="73" font-size="7.5" fill="#64748b" text-anchor="middle">Dense Reconstruct</text>

      <!-- Reconstructed Output -->
      <path d="M 495 62 L 530 62" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
      <rect x="535" y="20" width="130" height="85" rx="6" fill="#f0fdf4" stroke="#16a34a" stroke-width="1.5"/>
      <text x="600" y="42" font-size="9" font-weight="bold" fill="#15803d" text-anchor="middle">Reconstructed X̂</text>
      <text x="600" y="60" font-size="7.5" fill="#475569" text-anchor="middle">MSE Loss = ‖X - X̂‖²</text>
      <text x="600" y="77" font-size="8" font-weight="bold" fill="#0f172a" text-anchor="middle">Threshold: 0.0489</text>
      <text x="600" y="92" font-size="7.5" fill="#15803d" text-anchor="middle">Anomaly if Score > Thresh</text>
    </svg>
    <div class="diagram-caption">Figure 3.1: Latent Bottleneck Compression & Reconstruction Error Comparator in Model 1.</div>
  </div>

  <h3>3.3 Dataset Parameters & Normalization Specifications</h3>
  <p>
    The continuous vitals model is trained on synthesized clinical recovery telemetry matching adult post-operative recovery physiology (derived from distributions aligned with the PhysioNet MIMIC-III and HiRID clinical benchmarks):
  </p>

  <table>
    <thead>
      <tr>
        <th>Biomarker Channel</th>
        <th>Physical Unit</th>
        <th>Nominal Range</th>
        <th>Pathological Regimes</th>
        <th>Preprocessing Scale Factor</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Heart Rate (HR)</strong></td>
        <td>Beats / Minute (BPM)</td>
        <td>$60 - 95\text{ BPM}$ ($\mu \approx 74.2$)</td>
        <td>Bradycardia ($<50$), Tachycardia ($>110$), SVT ($>140$)</td>
        <td>`StandardScaler` ($\mu=74.21, \sigma=11.45$)</td>
      </tr>
      <tr>
        <td><strong>Blood Oxygen (SpO2)</strong></td>
        <td>Percentage ($\%$)</td>
        <td>$96\% - 100\%$ ($\mu \approx 98.4$)</td>
        <td>Mild Hypoxia ($91-94\%$), Critical Hypoxemia ($<90\%$)</td>
        <td>`StandardScaler` ($\mu=98.38, \sigma=1.22$)</td>
      </tr>
      <tr>
        <td><strong>Body Temperature</strong></td>
        <td>Celsius ($^\circ\text{C}$)</td>
        <td>$36.5^\circ\text{C} - 37.3^\circ\text{C}$</td>
        <td>Hypothermia ($<35.5^\circ\text{C}$), Febrile Pyrexia ($>38.5^\circ\text{C}$)</td>
        <td>`StandardScaler` ($\mu=36.85, \sigma=0.34$)</td>
      </tr>
    </tbody>
  </table>

  <div class="callout callout-green">
    <div class="callout-title">✓ Dynamic Anomaly Threshold Calibration</div>
    The decision boundary $\theta_{\text{vitals}}$ is established empirically by evaluating the model over $10,000$ validated healthy recovery windows and computing the <strong>$99\text{th}$ percentile of the reconstruction error</strong> ($\theta = 0.0489$). During online streaming inference, any physiological sequence yielding $\mathcal{L}_{\text{MSE}} > 0.0489$ immediately flags an early deterioration warning.
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 4: MODEL 2 - FALL DETECTION & KINETIC SENTINEL                 -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="section-block page-break">
  <h2>4. Model 2: Wearable Fall Detection & Kinetic Sentinel</h2>

  <h3>4.1 The Tri-Phasic Biomechanics of Human Falls</h3>
  <p>
    A fall is not a momentary instantaneous snapshot; it is a rapid, non-linear kinetic event spanning approximately $300\text{ms}$ to $800\text{ms}$. To achieve high discrimination without false alarms, the architecture must model the entire <strong>tri-phasic kinetic sequence</strong>:
  </p>
  <ol>
    <li>
      <strong>Phase 1: Freefall / Balance Loss ($0 - 200\text{ms}$):</strong> The center of gravity collapses downward. Acceleration magnitude drops abruptly from nominal $1.0g$ toward weightlessness ($a_{\text{mag}} < 0.5g$).
    </li>
    <li>
      <strong>Phase 2: Impact Collision Shockwave ($200 - 350\text{ms}$):</strong> The body strikes the floor. Acceleration spikes violently across multiple axes ($a_{\text{mag}} > 3.0g - 12.0g+$), generating high-frequency jerk and rotational torque ($>200^\circ/\text{s}$).
    </li>
    <li>
      <strong>Phase 3: Post-Impact Motionless Inactivity ($350 - 1000\text{ms}$):</strong> The patient lies immobilized. Gyroscope angular velocity collapses to near-zero ($0^\circ/\text{s}$), and the accelerometer settles along a new spatial gravity axis ($a_z \approx 0g$, $a_x \text{ or } a_y \approx 1g$, confirming horizontal recumbency).
    </li>
  </ol>

  <div class="diagram-container">
    <svg width="680" height="150" viewBox="0 0 680 150" xmlns="http://www.w3.org/2000/svg">
      <!-- Coordinate grid -->
      <line x1="40" y1="120" x2="660" y2="120" stroke="#94a3b8" stroke-width="1.5"/>
      <line x1="40" y1="15" x2="40" y2="120" stroke="#94a3b8" stroke-width="1.5"/>
      <text x="32" y="25" font-size="8" fill="#64748b" text-anchor="end">8g</text>
      <text x="32" y="70" font-size="8" fill="#64748b" text-anchor="end">3g</text>
      <text x="32" y="95" font-size="8" fill="#64748b" text-anchor="end">1g</text>
      <text x="32" y="115" font-size="8" fill="#64748b" text-anchor="end">0g</text>

      <!-- Shaded Phase 1 -->
      <rect x="130" y="20" width="80" height="100" fill="#f0f9ff" opacity="0.6"/>
      <text x="170" y="32" font-size="7.5" font-weight="bold" fill="#0284c7" text-anchor="middle">Phase 1: Freefall</text>

      <!-- Shaded Phase 2 -->
      <rect x="210" y="20" width="100" height="100" fill="#fef2f2" opacity="0.6"/>
      <text x="260" y="32" font-size="7.5" font-weight="bold" fill="#dc2626" text-anchor="middle">Phase 2: Impact Shock</text>

      <!-- Shaded Phase 3 -->
      <rect x="310" y="20" width="220" height="100" fill="#f5f3ff" opacity="0.6"/>
      <text x="420" y="32" font-size="7.5" font-weight="bold" fill="#7c3aed" text-anchor="middle">Phase 3: Posture Inversion & Stillness</text>

      <!-- 1g Baseline dotted line -->
      <line x1="40" y1="95" x2="660" y2="95" stroke="#cbd5e1" stroke-dasharray="3,3" stroke-width="1"/>

      <!-- Acceleration Curve -->
      <path d="M 40 95 Q 80 93 130 95 C 150 95, 160 115, 185 116 C 205 117, 215 40, 235 22 C 245 15, 255 110, 275 80 C 290 60, 305 95, 330 95 L 660 95" fill="none" stroke="#2563eb" stroke-width="2.5"/>

      <!-- Annotations -->
      <circle cx="185" cy="116" r="4" fill="#0284c7"/>
      <text x="185" y="132" font-size="7" fill="#0284c7" text-anchor="middle">Weightless Dip (&lt;0.5g)</text>

      <circle cx="235" cy="22" r="4" fill="#dc2626"/>
      <text x="235" y="14" font-size="7.5" font-weight="bold" fill="#dc2626" text-anchor="middle">Impact Peak (6.8g)</text>

      <circle cx="450" cy="95" r="4" fill="#7c3aed"/>
      <text x="450" y="85" font-size="7" fill="#7c3aed" text-anchor="middle">Horizontal Gravity Reorientation (az ≈ 0g)</text>
    </svg>
    <div class="diagram-caption">Figure 4.1: Tri-Phasic Fall Kinematics Profile (Freefall → Impact Spike → Inactivity).</div>
  </div>

  <h3>4.2 Deep Learning Architecture: Multi-Scale 1D-CNN + BiLSTM + Attention</h3>
  <p>
    To model this waveform, PulseNet implements a custom deep learning network combining spatial kernel diversity, bidirectional temporal recurrence, and dot-product attention:
  </p>
  <ul>
    <li>
      <strong>Multi-Scale Conv1D Kernels (3, 5, 7):</strong> A single kernel size is inadequate. Kernel 3 captures sharp instantaneous shock peaks ($15\text{ms}$ duration); Kernel 5 models the deceleration collision curve; Kernel 7 extracts broader body posture rotation. Concatenating their feature maps creates a rich multi-resolution temporal representation.
    </li>
    <li>
      <strong>Bidirectional LSTM (64 Units):</strong> Processes the sequence both forward (detecting the transition from freefall to impact) and backward (validating that the impact was followed by stillness rather than continued walking).
    </li>
    <li>
      <strong>Dot-Product Attention Layer:</strong> Dynamically calculates attention weights across all 50 pooled timesteps, focusing network gradients directly on the critical collision point while attenuating buffer noise.
    </li>
  </ul>

  <h3>4.3 SisFall Benchmark Dataset Parameters</h3>
  <p>
    The model is trained on the globally recognized <strong>SisFall Benchmark Dataset</strong> created by SISTEMIC (Universidad de Antioquia, Colombia):
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Dataset Metric</th>
        <th style="width: 35%;">Parameter Specification</th>
        <th style="width: 40%;">Clinical Significance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Subject Demographics</strong></td>
        <td><strong>38 Total Subjects:</strong><br>• 23 Young Adults (`SA01–SA23`, Age 19–30)<br>• 15 Elderly Participants (`SE01–SE15`, Age 60–75)</td>
        <td>Enables evaluation across age-related gait variations, body masses ($41.5-80.5\text{ kg}$), and heights ($149-183\text{ cm}$).</td>
      </tr>
      <tr>
        <td><strong>Sensor Hardware</strong></td>
        <td>• ADXL345: 3-Axis Accel ($\pm 16g$, 13-bit)<br>• ITG3200: 3-Axis Gyro ($\pm 2000^\circ/\text{s}$, 16-bit)</td>
        <td>Mounted at the center of mass (waist belt buckle). High dynamic range captures extreme shocks without sensor saturation.</td>
      </tr>
      <tr>
        <td><strong>Physical Scaling</strong></td>
        <td>• Accel: $\text{Raw} \times \frac{2 \times 16.0}{8192.0} = 0.00390625\,g/\text{LSB}$<br>• Gyro: $\text{Raw} \times \frac{2000.0}{32768.0} = 0.061035\,^\circ/\text{s/LSB}$</td>
        <td>Transforms raw discrete ADC counts directly into physical standard units ($g$ and $^\circ/\text{s}$) prior to tensor operations.</td>
      </tr>
      <tr>
        <td><strong>Window Dimensions</strong></td>
        <td>• Window: $100\text{ samples}$ ($0.5\text{s}$ at $200\text{ Hz}$)<br>• Pre-Impact Offset: $35\text{ samples}$ ($175\text{ms}$)</td>
        <td>Captures $175\text{ms}$ of pre-impact weightlessness + $325\text{ms}$ of collision shock and post-impact posture.</td>
      </tr>
      <tr>
        <td><strong>Activity Repertoire</strong></td>
        <td><strong>4,505 Continuous Trial Recordings:</strong><br>• 15 Fall Types (`F01–F15`: slips, trips, syncope)<br>• 19 ADL Types (`D01–D19`: walk, jump, sit, lie)</td>
        <td>Comprehensive coverage of high-kinetic daily activities (jumping, stumbling, rapid chair collapse) as hard negatives.</td>
      </tr>
    </tbody>
  </table>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 5: OVERFITTING AUDIT & STRESS TESTING                          -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="section-block page-break">
  <h2>5. Overfitting Audit, Data Leakage Proof & Real-World Stress Tests</h2>

  <h3>5.1 The ~99% Accuracy Paradox: Empirical Leakage Investigation</h3>
  <p>
    When standard machine learning workflows are applied to SisFall, models frequently report an astonishing <strong>$99.88\%$ accuracy</strong> with near-zero false alarms. Our technical audit proved that this metric is an artifact of <strong>within-trial temporal data leakage</strong>:
  </p>
  <ul>
    <li>
      <strong>Data Augmentation Mechanism:</strong> In `preprocess.py`, each fall trial is sliced into 5 jittered windows centered at offsets $[-14, -7, 0, +7, +14]$ samples around the impact peak (only $35\text{ms}$ apart).
    </li>
    <li>
      <strong>The Leakage Vector:</strong> In `train.py`, `train_test_split(test_size=0.20)` performs uniform random sampling across individual windows.
    </li>
    <li>
      <strong>Mathematical Proof of Overfitting:</strong> For any fall trial with 5 jittered slices, the probability that at least one sibling slice lands in the training set while another lands in the test set is:
      $$P(\text{leakage}) = 1 - (0.20)^4 = 99.84\%$$
      Therefore, <strong>over $99.8\%$ of the test fall samples have an identical sister waveform in the training set</strong>. The neural network does not learn invariant fall physics; it recognizes the exact identical trial it was trained on.
    </li>
  </ul>

  <h3>5.2 Empirical Stress-Testing on Real-World Edge Cases</h3>
  <p>
    To verify where the model actually succeeds and fails outside the laboratory benchmark, we developed a synthetic kinematic stress-testing harness ([`ml/fall_model/stress_test_edge_cases.py`](file:///c:/Users/patel%20krisha/Desktop/Minor/Minor_Project_New/ml/fall_model/stress_test_edge_cases.py)) evaluating 6 realistic clinical edge cases:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Test Scenario</th>
        <th style="width: 15%;">Model Output</th>
        <th style="width: 20%;">Diagnostic Verdict</th>
        <th style="width: 40%;">Root Cause & Clinical Risk Analysis</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Ideal High-Impact Fall</strong><br>(Freefall → $5g$ Shock → Rest)</td>
        <td><strong>94.10%</strong></td>
        <td><span class="tag tag-green">FALL DETECTED</span></td>
        <td><strong>Correct Detection:</strong> Clean physical alignment with trained SisFall parameters. High confidence.</td>
      </tr>
      <tr>
        <td><strong>2. Soft Fall / Slow Slide</strong><br>(Elderly sliding from bed, peak $1.2g$)</td>
        <td><strong>0.75%</strong></td>
        <td><span class="tag tag-red">FALSE NEGATIVE</span></td>
        <td><strong>CRITICAL CLINICAL HAZARD:</strong> Frail elderly individuals suffering orthostatic collapse slide slowly without high kinetic collision ($<1.8g$). The model completely misses the fall!</td>
      </tr>
      <tr>
        <td><strong>3. Vigorous Arm Gesture</strong><br>(Clapping, waving, no freefall)</td>
        <td><strong>99.74%</strong></td>
        <td><span class="tag tag-red">FALSE ALARM (FP)</span></td>
        <td><strong>FALSE POSITIVE ALARM:</strong> High centrifugal acceleration and angular velocity on the wrist fool the model into hallucinating a fall with $99.7\%$ certainty.</td>
      </tr>
      <tr>
        <td><strong>4. Device Dropped on Table</strong><br>(Mechanical drop, sharp shock)</td>
        <td><strong>91.09%</strong></td>
        <td><span class="tag tag-red">FALSE ALARM (FP)</span></td>
        <td><strong>FALSE POSITIVE ALARM:</strong> A wearable dropped onto a hard surface exhibits zero-g drop followed by a high shock spike and still rest, triggering emergency alert dispatch.</td>
      </tr>
      <tr>
        <td><strong>5. Fall + Agitated Movement</strong><br>(Patient falling & struggling/crawling)</td>
        <td><strong>99.76%</strong></td>
        <td><span class="tag tag-green">FALL DETECTED</span></td>
        <td><strong>Correct Detection:</strong> The multi-scale Conv1D layers successfully capture the primary impact spike regardless of subsequent struggling.</td>
      </tr>
      <tr>
        <td><strong>6. Stumble & Immediate Recovery</strong><br>(Trip jerk, then resumed stride)</td>
        <td><strong>49.39%</strong></td>
        <td><span class="tag tag-amber">BORDERLINE</span></td>
        <td><strong>Edge Ambiguity:</strong> Peak forward jerk ($3.2g$) lands directly on the $50\%$ decision boundary; susceptible to intermittent false alarms.</td>
      </tr>
    </tbody>
  </table>

  <h3>5.3 Production Hardening & Remediation Protocols</h3>
  <div class="callout callout-blue">
    <div class="callout-title">🛡️ Recommended PulseNet Clinical Safety Protections</div>
    <ol>
      <li>
        <strong>GroupKFold by Subject (Leave-Subjects-Out Validation):</strong> Partition datasets strictly by participant ID (`SA01–SA23`, `SE01–SE15`) so that no individual's kinematics span both partitions. All jitter augmentation must be confined strictly within training folds.
      </li>
      <li>
        <strong>Two-Stage Post-Fall Posture Sentinel (Inactivity Gate):</strong> High-impact alarms ($P_{\text{fall}} > 0.75$) must not dispatch emergency ambulances immediately. The backend initiates a <strong>$3\text{-second}$ posture observation window</strong>. If vertical movement or regular stride patterns resume immediately, the event is re-classified as a benign stumble/drop.
      </li>
      <li>
        <strong>Resonance Frequency Drop Filtering:</strong> Mechanical device drops onto tables generate contact shock durations under $12\text{ms}$ with high-frequency resonance ($>50\text{ Hz}$). Human body tissue deformation dampens impacts over $50-120\text{ms}$ with dominant spectral energy below $20\text{ Hz}$. Low-pass Butterworth filtering eliminates hard-surface drop false alarms.
      </li>
    </ol>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 6: COMPLETE DATA PIPELINE & IMPLEMENTATION                     -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="section-block avoid-break">
  <h2>6. Data Preprocessing & Online Streaming Implementation</h2>

  <h3>6.1 Step-by-Step Data Flow: From Raw Sensor ADC to Alert Dispatch</h3>
  <div class="diagram-container">
    <svg width="680" height="85" viewBox="0 0 680 85" xmlns="http://www.w3.org/2000/svg">
      <!-- Step 1 -->
      <rect x="5" y="15" width="115" height="55" rx="5" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.2"/>
      <text x="62" y="35" font-size="8.5" font-weight="bold" fill="#1e40af" text-anchor="middle">1. Sensor Acquisition</text>
      <text x="62" y="52" font-size="7.5" fill="#475569" text-anchor="middle">Raw ADC Bits @ 200Hz</text>

      <path d="M 120 42 L 140 42" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>

      <!-- Step 2 -->
      <rect x="145" y="15" width="115" height="55" rx="5" fill="#f8fafc" stroke="#64748b" stroke-width="1.2"/>
      <text x="202" y="35" font-size="8.5" font-weight="bold" fill="#0f172a" text-anchor="middle">2. Unit Scaling</text>
      <text x="202" y="52" font-size="7.5" fill="#475569" text-anchor="middle">Convert to g & °/s</text>

      <path d="M 260 42 L 280 42" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>

      <!-- Step 3 -->
      <rect x="285" y="15" width="115" height="55" rx="5" fill="#f8fafc" stroke="#64748b" stroke-width="1.2"/>
      <text x="342" y="35" font-size="8.5" font-weight="bold" fill="#0f172a" text-anchor="middle">3. FIFO Buffering</text>
      <text x="342" y="52" font-size="7.5" fill="#475569" text-anchor="middle">Deque Window: 100 / 30</text>

      <path d="M 400 42 L 420 42" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>

      <!-- Step 4 -->
      <rect x="425" y="15" width="115" height="55" rx="5" fill="#fef3c7" stroke="#d97706" stroke-width="1.2"/>
      <text x="482" y="35" font-size="8.5" font-weight="bold" fill="#92400e" text-anchor="middle">4. Standard Scaling</text>
      <text x="482" y="52" font-size="7.5" fill="#475569" text-anchor="middle">Z = (X - μ) / σ</text>

      <path d="M 540 42 L 560 42" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>

      <!-- Step 5 -->
      <rect x="565" y="15" width="110" height="55" rx="5" fill="#f0fdf4" stroke="#16a34a" stroke-width="1.2"/>
      <text x="620" y="35" font-size="8.5" font-weight="bold" fill="#15803d" text-anchor="middle">5. Model Scoring</text>
      <text x="620" y="52" font-size="7.5" fill="#475569" text-anchor="middle">Inference & Alert Logic</text>
    </svg>
    <div class="diagram-caption">Figure 6.1: Complete Pipeline Flow from Biosensor Data Capture to Inference Scoring.</div>
  </div>

  <h3>6.2 Backend Real-Time Streaming Architecture (`ml_inference.py`)</h3>
  <p>
    In the production FastAPI backend ([`backend/ml_inference.py`](file:///c:/Users/patel%20krisha/Desktop/Minor/Minor_Project_New/backend/ml_inference.py)), live telemetry packets are processed in real time:
  </p>
  <ul>
    <li>
      <strong>Zero-Allocation Deque Buffering:</strong> Sliding window buffers (`vitals_buffers` with length 30 and `fall_buffers` with length 100) are maintained per patient using double-ended queues (`collections.deque(maxlen=N)`), guaranteeing $O(1)$ constant time appends and memory efficiency.
    </li>
    <li>
      <strong>Startup Buffer Priming:</strong> On system initialization or sensor reconnection, the initial telemetry packet primes the buffer immediately via left-fill, ensuring anomaly scoring is operational from the very first packet rather than waiting for 30 seconds of cold buffering.
    </li>
    <li>
      <strong>Dynamic Acceleration Gating:</strong> In [`infer_fall()`](file:///c:/Users/patel%20krisha/Desktop/Minor/Minor_Project_New/backend/ml_inference.py#L86-L116), total vector magnitude $a_{\text{mag}} = \sqrt{a_x^2 + a_y^2 + a_z^2}$ is evaluated. If $a_{\text{mag}} < 1.8g$, the deep neural network prediction is bypassed ($0.0\text{ confidence}$), saving substantial CPU compute and preventing false triggers during restful sitting or slow ambulation.
    </li>
  </ul>

  <div class="footer-note">
    PulseNet Platform Technical Documentation · Confidential & Proprietary · © 2026 PulseNet Health Systems. All clinical rights reserved.
  </div>
</section>

</body>
</html>
"""

def main():
    print("=" * 70)
    print("  PulseNet AI Technical Documentation PDF Generator")
    print("=" * 70)

    browser = find_browser()
    if not browser:
        print("[ERROR] Neither Google Chrome nor Microsoft Edge was found on this system.")
        sys.exit(1)

    print(f"Discovered browser engine: {browser}")

    print(f"Writing structured technical HTML to: {TEMP_HTML}")
    with open(TEMP_HTML, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Compiling publication-quality PDF via headless printing...")
    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        f"--print-to-pdf={OUTPUT_PDF}",
        "--no-pdf-header-footer",
        TEMP_HTML
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[ERROR] PDF generation failed with code {res.returncode}: {res.stderr}")
        sys.exit(res.returncode)

    if os.path.exists(OUTPUT_PDF):
        size_kb = os.path.getsize(OUTPUT_PDF) / 1024
        print(f"[SUCCESS] PDF Generated Successfully!")
        print(f"  File location : {OUTPUT_PDF}")
        print(f"  File size     : {size_kb:.1f} KB")
    else:
        print("[ERROR] Output PDF file was not created.")

if __name__ == "__main__":
    main()

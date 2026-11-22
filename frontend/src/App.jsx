import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import PatientDashboard from './pages/PatientDashboard'
import DoctorDashboard from './pages/DoctorDashboard'
import ErrorBoundary from './components/ErrorBoundary'

function PrivateRoute({ children, role }) {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if (!user) return <Navigate to="/login" />
  if (role) {
    if (Array.isArray(role)) {
      if (!role.includes(user.role)) return <Navigate to="/login" />
    } else {
      if (user.role !== role) return <Navigate to="/login" />
    }
  }
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/"       element={<LandingPage />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/patient" element={
            <PrivateRoute role="patient"><PatientDashboard /></PrivateRoute>
          } />
          <Route path="/doctor" element={
            <PrivateRoute role="doctor"><DoctorDashboard /></PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

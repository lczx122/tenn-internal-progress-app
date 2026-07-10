import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { isConfigured } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import JobsList from './pages/JobsList'
import JobDetail from './pages/JobDetail'
import NewJob from './pages/NewJob'
import UnitsBulk from './pages/UnitsBulk'
import Quotation from './pages/Quotation'
import QuotesRegister from './pages/QuotesRegister'
import Schedule from './pages/Schedule'
import AppointmentForm from './pages/AppointmentForm'
import StaffAdmin from './pages/StaffAdmin'
import ProjectsAdmin from './pages/ProjectsAdmin'
import AdminSettings from './pages/AdminSettings'
import Claims from './pages/Claims'
import Reports from './pages/Reports'
import SuppliersAdmin from './pages/SuppliersAdmin'
import CostingList from './pages/CostingList'
import CostingForm from './pages/CostingForm'
import GameView from './pages/GameView'
import SetupNotice from './pages/SetupNotice'

export default function App() {
  const { session, loading, roleReady, isGuest } = useAuth()

  if (!isConfigured) return <SetupNotice />

  // Wait for the session and (when signed in) the role before rendering, so a
  // guest never briefly sees an internal page.
  if (loading || (session && !roleReady)) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  // Guests can only reach the quotation generator.
  if (isGuest) {
    return (
      <Routes>
        <Route path="/quote" element={<Quotation />} />
        <Route path="*" element={<Navigate to="/quote" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/units" element={<JobsList />} />
      <Route path="/units/bulk" element={<UnitsBulk />} />
      <Route path="/claims" element={<Claims />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/quote" element={<Quotation />} />
      <Route path="/quotes" element={<QuotesRegister />} />
      <Route path="/schedule" element={<Schedule />} />
      <Route path="/schedule/new" element={<AppointmentForm />} />
      <Route path="/appointment/:id" element={<AppointmentForm />} />
      <Route path="/staff" element={<StaffAdmin />} />
      <Route path="/projects" element={<ProjectsAdmin />} />
      <Route path="/suppliers" element={<SuppliersAdmin />} />
      <Route path="/settings" element={<AdminSettings />} />
      <Route path="/game" element={<GameView />} />
      <Route path="/costing" element={<CostingList />} />
      <Route path="/costing/new" element={<CostingForm />} />
      <Route path="/costing/:id" element={<CostingForm />} />
      <Route path="/job/:id" element={<JobDetail />} />
      <Route path="/job/:id/edit" element={<NewJob />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

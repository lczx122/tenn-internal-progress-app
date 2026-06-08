import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { isConfigured } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import JobsList from './pages/JobsList'
import JobDetail from './pages/JobDetail'
import NewJob from './pages/NewJob'
import Quotation from './pages/Quotation'
import SetupNotice from './pages/SetupNotice'

export default function App() {
  const { session, loading } = useAuth()

  if (!isConfigured) return <SetupNotice />

  if (loading) {
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

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/units" element={<JobsList />} />
      <Route path="/new" element={<NewJob />} />
      <Route path="/quote" element={<Quotation />} />
      <Route path="/job/:id" element={<JobDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import PublicLayout from './components/Layout.jsx'
import { ToastProvider } from './components/ui.jsx'
import EventList from './pages/EventList.jsx'
import EventPage from './pages/EventPage.jsx'
import Pay from './pages/Pay.jsx'
import Booking from './pages/Booking.jsx'
import FindBooking from './pages/FindBooking.jsx'
import AdminLayout from './admin/AdminLayout.jsx'
import Login from './admin/Login.jsx'
import Dashboard from './admin/Dashboard.jsx'
import AdminEvents from './admin/Events.jsx'
import EventEditor from './admin/EventEditor.jsx'
import Registrations from './admin/Registrations.jsx'
import Interest from './admin/Interest.jsx'
import Settings from './admin/Settings.jsx'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// HashRouter so the demo works on GitHub Pages without server rewrites.
export default function App() {
  return (
    <HashRouter>
      <ScrollTop />
      <ToastProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<EventList />} />
            <Route path="event/:id" element={<EventPage />} />
            <Route path="pay/:id" element={<Pay />} />
            <Route path="booking/:id" element={<Booking />} />
            <Route path="find" element={<FindBooking />} />
          </Route>
          <Route path="admin/login" element={<Login />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="events/new" element={<EventEditor />} />
            <Route path="events/:id" element={<EventEditor />} />
            <Route path="registrations" element={<Registrations key="all" />} />
            <Route path="failed" element={<Registrations failedOnly key="failed" />} />
            <Route path="interest" element={<Interest />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </HashRouter>
  )
}

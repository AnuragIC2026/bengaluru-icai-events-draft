import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate, useOutletContext, Link } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, Receipt, BellRing, Settings as SettingsIcon, LogOut, Menu, ExternalLink, ShieldAlert } from 'lucide-react'
import logo from '../assets/icai-logo.png'
import { currentUser, logout } from '../lib/data.js'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'accounts'], end: true },
  { to: '/admin/events', label: 'Events', icon: CalendarDays, roles: ['admin'] },
  { to: '/admin/registrations', label: 'Registrations', icon: Receipt, roles: ['admin', 'accounts'] },
  { to: '/admin/interest', label: 'Interest list', icon: BellRing, roles: ['admin'] },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin'] },
]

export const ROLE_LABEL = { admin: 'Admin', accounts: 'Accounts' }

export function useAdmin() {
  return useOutletContext()
}

export function RequireRole({ role, children }) {
  const { user } = useAdmin()
  if (user.role !== role)
    return (
      <div className="denied">
        <ShieldAlert size={40} color="#A65A0A" />
        <h1 style={{ fontSize: 24, margin: '12px 0 6px' }}>This page is for admins</h1>
        <p className="muted">Your login can see registrations and payments only.</p>
        <Link className="btn btn-primary" to="/admin/registrations" style={{ marginTop: 18 }}>
          Go to registrations
        </Link>
      </div>
    )
  return children
}

export default function AdminLayout() {
  const [user, setUser] = useState(currentUser())
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => {
    setOpen(false)
  }, [loc.pathname])
  if (!user) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />

  const items = NAV.filter((n) => n.roles.includes(user.role))
  const out = () => {
    logout()
    setUser(null)
    nav('/admin/login')
  }

  return (
    <div className="admin">
      {open && <div className="side-back" onClick={() => setOpen(false)} />}
      <aside className={`side ${open ? 'open' : ''}`} aria-label="Admin menu">
        <div className="side-brand">
          <span className="logo">
            <img src={logo} alt="ICAI" />
          </span>
          <span>
            <b>Event admin</b>
            <small>ICAI Bengaluru Branch (SIRC)</small>
          </span>
        </div>
        <nav>
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={19} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <a className="view" href="#/" target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Open the public portal
          </a>
          <div className="who">
            <span className="av">{user.name.charAt(0)}</span>
            <span>
              <b>{user.name}</b>
              {ROLE_LABEL[user.role]} role
            </span>
          </div>
          <button className="btn btn-sm" onClick={out}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-top">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <b>Event admin</b>
        </div>
        <div className="admin-in">
          <Outlet context={{ user }} />
        </div>
      </div>
    </div>
  )
}

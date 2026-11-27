import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import logo from '../assets/icai-logo.png'
import { login, currentUser, DEMO_USERS } from '../lib/data.js'
import { Field, TextInput } from '../components/ui.jsx'

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    document.title = 'Admin login | Bengaluru ICAI events'
    if (currentUser()) nav('/admin', { replace: true })
  }, [nav])
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    let u = null
    try {
      u = await login(email, pw)
    } catch (x) {
      setBusy(false)
      return setErr(x.message)
    }
    setBusy(false)
    if (!u) return setErr('Email or password is wrong.')
    const from = loc.state?.from
    // A manager only has the two registration pages, so send them there unless they were already headed to one.
    const managerOk = from?.startsWith('/admin/registrations') || from?.startsWith('/admin/failed')
    nav(u.role === 'manager' ? (managerOk ? from : '/admin/registrations') : from || '/admin', { replace: true })
  }
  const fill = (u) => {
    setEmail(u.email)
    setPw(u.password)
    setErr('')
  }
  return (
    <div className="login-wrap">
      <form className="login" onSubmit={submit} noValidate>
        <img className="logo" src={logo} alt="The Institute of Chartered Accountants of India" />
        <h1>Event admin</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          ICAI Bengaluru Branch (SIRC)
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Email" id="l-email">
            <TextInput id="l-email" type="email" value={email} onChange={setEmail} autoComplete="username" />
          </Field>
          <Field label="Password" id="l-pw">
            <TextInput id="l-pw" type="password" value={pw} onChange={setPw} autoComplete="current-password" />
          </Field>
        </div>
        {err && (
          <div className="notice err" style={{ marginTop: 14 }} role="alert">
            {err}
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }}>
          <LogIn size={18} /> {busy ? 'Logging in...' : 'Log in'}
        </button>
        {DEMO_USERS.length > 0 && (
        <div className="demo-creds">
          <b>Test logins</b>
          {DEMO_USERS.map((u) => (
            <div key={u.email} style={{ marginTop: 4 }}>
              {u.role === 'admin' ? 'Admin' : 'Manager'}: <code>{u.email}</code> / <code>{u.password}</code>{' '}
              <button type="button" onClick={() => fill(u)}>
                Use
              </button>
            </div>
          ))}
        </div>
        )}
        <p style={{ marginTop: 16, fontSize: 14.5 }}>
          <Link to="/">Back to the public portal</Link>
        </p>
      </form>
    </div>
  )
}

import { Link, Outlet } from 'react-router-dom'
import { Search, FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IS_DEMO, getSettings } from '../lib/data.js'
import logo from '../assets/icai-logo.png'
import { Modal } from './ui.jsx'
import { POLICIES } from '../data/policies.js'
import Skyline from './Skyline.jsx'

export function DemoBar() {
  const [text, setText] = useState(IS_DEMO ? 'Test version. Payment is simulated.' : '')
  useEffect(() => {
    if (IS_DEMO) return
    getSettings()
      .then((s) => setText(s.paymentMode === 'test' ? 'Test mode. Payment is simulated.' : ''))
      .catch(() => {})
  }, [])
  if (!text) return null
  return (
    <div className="demo-bar no-print">
      <FlaskConical size={15} />
      <span>{text}</span>
    </div>
  )
}

export function Header() {
  return (
    <header className="site-head">
      <div className="wrap">
        <div className="brand">
          <a href="https://bangaloreicai.org" className="brand-logo" title="Go to bangaloreicai.org">
            <img src={logo} alt="The Institute of Chartered Accountants of India, go to the ICAI Bengaluru Branch (SIRC) website" width="128" height="60" />
          </a>
          <span className="divider" />
          <Link to="/" className="brand-text" aria-label="Event registration home">
            <strong>Event Registration</strong>
            <small>ICAI Bengaluru Branch (SIRC)</small>
          </Link>
        </div>
        <nav className="head-links" aria-label="Main">
          <Link to="/find" className="head-btn">
            <Search size={17} />
            <span>Find a booking</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function PolicyModal({ slug, onClose }) {
  const p = POLICIES[slug]
  if (!p) return null
  return (
    <Modal title={p.title} onClose={onClose}>
      <div className="policy">
        {p.body.map((line, i) =>
          line === line.toUpperCase() && /[A-Z]/.test(line) ? (
            <h3 key={i}>{line.charAt(0) + line.slice(1).toLowerCase()}</h3>
          ) : (
            <p key={i}>{line}</p>
          ),
        )}
      </div>
    </Modal>
  )
}

export function Footer() {
  const [policy, setPolicy] = useState(null)
  return (
    <footer className="site-foot">
      <div className="foot-sky" aria-hidden="true">
        <Skyline variant="night" />
      </div>
      <div className="wrap foot-grid">
        <div>
          <h4>ICAI Bengaluru Branch (SIRC)</h4>
          <p>ICAI Bhawan, #16/O, Millers Tank Bed Area, Vasanth Nagar, Bengaluru 560052</p>
          <p style={{ marginTop: 8 }}>
            <a href="tel:+918043944868">080 4394 4868</a>
          </p>
        </div>
        <div>
          <h4>Registration help</h4>
          <ul>
            <li>
              Member programmes: <a href="tel:+919880007905">98800 07905</a>
            </li>
            <li>
              <a href="mailto:blrregistrations@icai.org">blrregistrations@icai.org</a>
            </li>
            <li>
              SICASA events: <a href="tel:+919606913003">96069 13003</a>
            </li>
            <li>
              <a href="mailto:blrsicasa@icai.org">blrsicasa@icai.org</a>
            </li>
          </ul>
        </div>
        <div>
          <h4>Policies</h4>
          <ul>
            {Object.entries(POLICIES).map(([k, v]) => (
              <li key={k}>
                <button className="link-btn" style={{ color: '#DCE5F7', textDecoration: 'none', fontWeight: 500 }} onClick={() => setPolicy(k)}>
                  {v.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="foot-base">
        <div className="wrap">
          <span>© 2026 ICAI Bengaluru Branch (SIRC)</span>
          <a href="https://bangaloreicai.org" target="_blank" rel="noreferrer">
            bangaloreicai.org
          </a>
        </div>
      </div>
      {policy && <PolicyModal slug={policy} onClose={() => setPolicy(null)} />}
    </footer>
  )
}

export default function PublicLayout() {
  return (
    <>
      <DemoBar />
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

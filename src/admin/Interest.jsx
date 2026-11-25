import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { listInterest } from '../lib/store.js'
import { fmtDateTime } from '../lib/format.js'
import { exportInterest } from '../lib/excel.js'
import { RequireRole } from './AdminLayout.jsx'

function Inner() {
  const [rows, setRows] = useState(null)
  const [ev, setEv] = useState('')
  useEffect(() => {
    document.title = 'Interest list | Event admin'
    listInterest().then(setRows)
  }, [])
  const events = useMemo(() => [...new Map((rows || []).map((r) => [r.eventId, r.eventTitle])).entries()], [rows])
  const list = (rows || []).filter((r) => !ev || String(r.eventId) === ev)
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Interest list</h1>
          <p>People who missed a closed or full event and asked to hear if it runs again.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => exportInterest(list)} disabled={!list.length}>
            <FileSpreadsheet size={18} /> Download Excel
          </button>
        </div>
      </div>
      <div className="panel">
        {events.length > 1 && (
          <div className="filters">
            <label>
              <span className="sr-only">Event</span>
              <select value={ev} onChange={(e) => setEv(e.target.value)}>
                <option value="">All events</option>
                {events.map(([id, t]) => (
                  <option key={id} value={id}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Event</th>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th className="hide-md">Added on</th>
              </tr>
            </thead>
            <tbody>
              {rows && !list.length && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    Nobody yet. The form shows on closed and fully booked events.
                  </td>
                </tr>
              )}
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="t-name">{r.eventTitle}</td>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.mobile}</td>
                  <td className="hide-md">{fmtDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default function Interest() {
  return (
    <RequireRole role="admin">
      <Inner />
    </RequireRole>
  )
}

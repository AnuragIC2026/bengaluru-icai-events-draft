import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react'
import { X, CircleCheck } from 'lucide-react'
import { CATEGORY_PLURAL, enabledCategories } from '../lib/pricing.js'

export function Field({ label, optional, error, help, children, className = '', id }) {
  return (
    <div className={`field ${error ? 'has-err' : ''} ${className}`}>
      {label && (
        <label htmlFor={id}>
          {label} {optional && <span className="opt">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="err-text" id={id ? `${id}-err` : undefined}>
          {error}
        </span>
      ) : help ? (
        <span className="help">{help}</span>
      ) : null}
    </div>
  )
}

export function TextInput({ id, value, onChange, error, ...rest }) {
  return (
    <input
      id={id}
      className="input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-err` : undefined}
      {...rest}
    />
  )
}

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} style={wide ? { maxWidth: 820 } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const show = useCallback((m) => {
    setMsg(m)
    clearTimeout(show.t)
    show.t = setTimeout(() => setMsg(null), 2800)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <CircleCheck size={18} /> {msg}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

export function AudienceChips({ event }) {
  const cats = enabledCategories(event)
  if (cats.length === 3) return <span className="chip">Open to all</span>
  return cats.map((c) => (
    <span key={c} className={`chip ${c === 'student' ? 'chip-student' : ''}`}>
      {CATEGORY_PLURAL[c]}
    </span>
  ))
}

export function isStudentEvent(event) {
  const cats = enabledCategories(event)
  return cats.length === 1 && cats[0] === 'student'
}

export function StateChip({ event }) {
  switch (event.state) {
    case 'closed':
      return <span className="chip chip-grey">Registration closed</span>
    case 'paused':
      return <span className="chip chip-grey">Bookings paused</span>
    case 'soon':
      return <span className="chip chip-saffron">Opens soon</span>
    case 'full':
      return <span className="chip chip-red">Fully booked</span>
    default:
      return null
  }
}

// Turns plain text into paragraphs and makes bare links clickable.
export function RichText({ text }) {
  if (!text) return null
  return text.split(/\n+/).map((line, i) => (
    <p key={i}>
      {line.split(/(https?:\/\/\S+)/g).map((part, j) =>
        /^https?:\/\//.test(part) ? (
          <a key={j} href={part} target="_blank" rel="noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  ))
}

// Input with its label inside the box. The label floats up once there is a value or focus.
export function FloatInput({ id, label, value, onChange, error, help, optional, className = '', ...rest }) {
  return (
    <div className={`fwrap ${error ? 'has-err' : ''} ${className}`}>
      <div className="ff">
        <input
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder=" "
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-err` : help ? `${id}-help` : undefined}
          {...rest}
        />
        <label htmlFor={id}>
          {label}
          {optional && <span className="opt"> (optional)</span>}
        </label>
      </div>
      {error ? (
        <span className="err-text" id={`${id}-err`}>
          {error}
        </span>
      ) : help ? (
        <span className="ff-help" id={`${id}-help`}>
          {help}
        </span>
      ) : null}
    </div>
  )
}

export function FloatSelect({ id, label, value, onChange, error, children, className = '' }) {
  return (
    <div className={`fwrap ${error ? 'has-err' : ''} ${className}`}>
      <div className="ff ff-select">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
        <label htmlFor={id}>{label}</label>
      </div>
      {error && (
        <span className="err-text" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  )
}

// Two or three choices shown as pills inside one input sized box.
export function FloatChoice({ id, label, value, onChange, options, error, className = '' }) {
  return (
    <div className={`fwrap ${error ? 'has-err' : ''} ${className}`}>
      <div className="ff ff-choice" role="radiogroup" aria-labelledby={`${id}-l`}>
        <span className="ff-l" id={`${id}-l`}>
          {label}
        </span>
        <div className="ff-pills">
          {options.map((o, k) => (
            <label key={o}>
              <input type="radio" id={k === 0 ? id : undefined} name={id} value={o} checked={value === o} onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </div>
      {error && (
        <span className="err-text" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  )
}

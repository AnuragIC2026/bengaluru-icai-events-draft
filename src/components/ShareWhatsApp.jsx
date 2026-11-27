import { MessageCircle } from 'lucide-react'
import { eventShareUrl, shareText, whatsappUrl } from '../lib/share.js'

// Opens WhatsApp (the app on phones, WhatsApp Web on computers) with a ready message about the event.
// variant 'button': labelled button. variant 'icon': small round button for the event cards.
export default function ShareWhatsApp({ event, gstRate, variant = 'button', label = 'Share on WhatsApp', className = '' }) {
  const url = eventShareUrl(event, {
    apiUrl: import.meta.env.VITE_API_URL || '',
    siteUrl: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
  })
  const href = whatsappUrl(shareText(event, gstRate, url))
  if (variant === 'icon')
    return (
      <a className={`wa-icon ${className}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share ${event.title} on WhatsApp`} title="Share on WhatsApp">
        <MessageCircle size={18} />
      </a>
    )
  return (
    <a className={`btn btn-wa ${className}`} href={href} target="_blank" rel="noopener noreferrer">
      <MessageCircle size={18} /> {label}
    </a>
  )
}

// Booking emails: a receipt to the billing email and a confirmation to each participant.
// Off by default (EMAIL_ENABLED=false). Works with any SMTP account.
import nodemailer from 'nodemailer'

const CAT = { member: 'Member', nonMember: 'Non-member', student: 'Student' }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const inr = (n) => '&#8377;' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function createMailer(cfg, { transport } = {}) {
  const t =
    transport ||
    (cfg.email.enabled
      ? nodemailer.createTransport({
          host: cfg.email.smtp.host,
          port: cfg.email.smtp.port,
          secure: cfg.email.smtp.secure,
          auth: cfg.email.smtp.user ? { user: cfg.email.smtp.user, pass: cfg.email.smtp.pass } : undefined,
        })
      : null)
  const sent = []

  async function send(msg) {
    if (!t) return { skipped: true }
    const info = await t.sendMail({ from: cfg.email.from, replyTo: cfg.email.replyTo || undefined, ...msg })
    sent.push({ ...msg, info })
    return info
  }

  function eventLines(event) {
    if (!event) return ''
    const when = event.endDate && event.endDate !== event.startDate ? `${event.startDate} to ${event.endDate}` : event.startDate
    return `<p style="margin:0 0 4px"><b>${esc(event.title)}</b></p><p style="margin:0;color:#56627A">${esc(when)}, ${esc(event.startTime)} to ${esc(event.endTime)}<br>${esc(event.venue)}</p>`
  }

  function layout(title, body) {
    return `<!doctype html><html><body style="margin:0;background:#F6F9FD;font-family:Arial,sans-serif;color:#14203D">
<div style="max-width:600px;margin:0 auto;padding:24px">
<div style="background:#092D77;color:#fff;border-radius:14px 14px 0 0;padding:18px 22px"><div style="font-size:13px;opacity:.85">Bengaluru Branch of SIRC of ICAI</div><div style="font-size:20px;font-weight:bold">${esc(title)}</div></div>
<div style="background:#fff;border:1px solid #DDE4EF;border-top:0;border-radius:0 0 14px 14px;padding:22px">${body}</div>
<p style="font-size:12px;color:#56627A;text-align:center;margin-top:14px">This is an automatic email from the branch event registration portal.</p>
</div></body></html>`
  }

  async function bookingPaid(booking, event, bookingUrl) {
    const p = booking.price
    const rows = booking.participants
      .map((x, i) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #EAEFF6">${i + 1}</td><td style="padding:6px 8px;border-bottom:1px solid #EAEFF6">${esc(x.name)}</td><td style="padding:6px 8px;border-bottom:1px solid #EAEFF6">${esc(x.idNumber || '')}</td></tr>`)
      .join('')
    const receipt = layout(
      `Receipt for booking ${booking.id}`,
      `${eventLines(event)}
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px"><tr style="background:#F6F9FD"><th align="left" style="padding:6px 8px">#</th><th align="left" style="padding:6px 8px">Name</th><th align="left" style="padding:6px 8px">Number</th></tr>${rows}</table>
<table style="width:100%;font-size:14px">
<tr><td>${esc(CAT[booking.category])} fee x ${p.qty}</td><td align="right">${inr(p.subtotal)}</td></tr>
${p.discount > 0 ? `<tr><td style="color:#1E8A4C">Group discount</td><td align="right" style="color:#1E8A4C">-${inr(p.discount)}</td></tr>` : ''}
<tr><td>GST ${p.gstRate ? p.gstRate + '%' : ''}</td><td align="right">${p.gstRate ? inr(p.gst) : 'Not applicable'}</td></tr>
<tr><td style="padding-top:8px;border-top:1px dashed #DDE4EF"><b>Total paid</b></td><td align="right" style="padding-top:8px;border-top:1px dashed #DDE4EF"><b>${inr(p.total)}</b></td></tr>
</table>
<p style="font-size:14px;margin-top:16px">Billed to ${esc(booking.contact.firm)}${booking.contact.gstin ? `, GSTIN ${esc(booking.contact.gstin)}` : ''}<br>${esc(booking.payment?.method || '')}${booking.payment?.ref ? `, reference ${esc(booking.payment.ref)}` : ''}</p>
<p style="margin-top:18px"><a href="${esc(bookingUrl)}" style="background:#092D77;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block">View your booking</a></p>`,
    )
    const out = [send({ to: booking.contact.email, subject: `Booking ${booking.id} confirmed: ${booking.eventTitle}`, html: receipt })]
    const seen = new Set([booking.contact.email.toLowerCase()])
    for (const person of booking.participants) {
      const to = (person.email || '').toLowerCase()
      if (!to || seen.has(to)) continue
      seen.add(to)
      out.push(
        send({
          to,
          subject: `You are registered: ${booking.eventTitle}`,
          html: layout('You are registered', `<p style="margin:0 0 14px">Dear ${esc(person.name)},</p><p style="margin:0 0 14px">${esc(booking.contact.firm)} has registered you for this event. Booking number ${esc(booking.id)}.</p>${eventLines(event)}`),
        }),
      )
    }
    const results = await Promise.allSettled(out)
    return results
  }

  return { bookingPaid, sent, enabled: !!t }
}

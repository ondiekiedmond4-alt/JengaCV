const axios = require('axios');

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Sends a transactional or promotional email via Resend.
 * If RESEND_API_KEY isn't set yet, logs a warning and skips sending instead
 * of crashing — so the rest of the app (registration, login) keeps working
 * even before email is configured.
 */
async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      `RESEND_API_KEY not set — email not sent. Would have sent "${subject}" to ${to}.`
    );
    return { skipped: true };
  }

  const from = process.env.EMAIL_FROM || 'JengaCV <onboarding@resend.dev>';

  const res = await axios.post(
    RESEND_URL,
    { from, to: [to], subject, html, text },
    { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Renders CV content as a single, clean, email-client-safe HTML block.
 *
 * Note on scope: this deliberately does NOT try to reproduce the exact
 * template/font/accent-color/background-pattern the person picked in the
 * builder — email clients have very limited, inconsistent CSS support, and
 * a true visual match would need server-side PDF rendering (e.g.
 * Puppeteer), which isn't set up in this deployment. This presents the
 * same CV *content* in one consistent, readable layout instead.
 */
function buildResumeEmailHtml(cv) {
  if (!cv) return '<p>No saved CV content found.</p>';
  const p = cv.personal || {};
  const section = (title, inner) => (inner ? `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#1f6f5c;margin:22px 0 8px;">${esc(title)}</h3>${inner}` : '');

  const expHtml = (cv.experience || []).filter(e => e.title || e.company).map(e => `
    <div style="margin-bottom:12px;">
      <div style="font-weight:600;font-size:14px;">${esc(e.title)}${e.company ? ' · ' + esc(e.company) : ''} <span style="font-weight:400;color:#888;">(${esc(e.start)} – ${esc(e.end)})</span></div>
      ${e.achievements ? `<ul style="margin:4px 0 0;padding-left:18px;font-size:13px;">${e.achievements.split('\n').filter(Boolean).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    </div>`).join('');

  const eduHtml = (cv.education || []).filter(e => e.degree || e.institution).map(e => `
    <div style="margin-bottom:8px;font-size:13.5px;"><strong>${esc(e.degree)}</strong> · ${esc(e.institution)} (${esc(e.start)}–${esc(e.end)})</div>`).join('');

  const skillsArr = (cv.skills || '').split(',').map(s => s.trim()).filter(Boolean);
  const skillsHtml = skillsArr.length ? `<p style="font-size:13.5px;">${skillsArr.map(esc).join(' &nbsp;·&nbsp; ')}</p>` : '';

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1c2333;max-width:600px;">
      <h2 style="font-size:22px;margin-bottom:2px;">${esc(p.name) || 'Your Name'}</h2>
      <div style="color:#1f6f5c;font-weight:600;margin-bottom:8px;">${esc(p.title) || ''}</div>
      <div style="font-size:12.5px;color:#666;">${[p.email, p.phone, p.location].filter(Boolean).map(esc).join(' · ')}</div>
      ${section('Summary', cv.summary ? `<p style="font-size:13.5px;">${esc(cv.summary)}</p>` : '')}
      ${section('Experience', expHtml)}
      ${section('Education', eduHtml)}
      ${section('Skills', skillsHtml)}
    </div>`;
}

module.exports = { sendEmail, buildResumeEmailHtml };

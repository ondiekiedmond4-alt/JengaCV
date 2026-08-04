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

module.exports = { sendEmail };

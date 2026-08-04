require('dotenv').config();
const pool = require('../db');
const { sendEmail } = require('../email');

// Usage: node scripts/send-promo.js "Subject line" "Message body text"
// Sends to every user who has opted in to marketing emails. Run this
// manually whenever you want to send an update — there's no scheduling
// or campaign UI, this is a deliberately simple one-shot tool.
async function main() {
  const [, , subject, ...messageParts] = process.argv;
  const message = messageParts.join(' ');

  if (!subject || !message) {
    console.log('Usage: node scripts/send-promo.js "Subject line" "Message body text"');
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set. Add it to your environment before sending.');
    process.exit(1);
  }

  const result = await pool.query(
    `SELECT email, name FROM users WHERE marketing_opt_in = true AND email IS NOT NULL`
  );
  console.log(`Sending "${subject}" to ${result.rows.length} opted-in user(s)...`);

  let sent = 0;
  let failed = 0;
  for (const user of result.rows) {
    try {
      await sendEmail({
        to: user.email,
        subject,
        html: `<p>Hi ${user.name || 'there'},</p>
               <p>${message}</p>
               <p style="color:#8a8d97;font-size:12px;margin-top:24px;">
                 You're receiving this because you opted in to JengaCV updates.
                 You can turn this off anytime from Account settings in the app.
               </p>`,
        text: `Hi ${user.name || 'there'},\n\n${message}\n\nYou're receiving this because you opted in to JengaCV updates. You can turn this off anytime from Account settings in the app.`,
      });
      console.log('  sent ->', user.email);
      sent++;
    } catch (err) {
      console.error('  FAILED ->', user.email, err.response?.data || err.message);
      failed++;
    }
  }

  console.log(`Done. Sent: ${sent}, Failed: ${failed}`);
  await pool.end();
}

main().catch((err) => {
  console.error('send-promo.js error:', err.message);
  process.exit(1);
});

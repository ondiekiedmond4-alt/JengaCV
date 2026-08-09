require('dotenv').config();
const pool = require('../db');

// Usage:
//   node scripts/pay-referrals.js              -> lists everyone owed money
//   node scripts/pay-referrals.js mark <userId> -> marks that referrer's
//                                                    pending earnings as paid
//
// Real cash payouts are NOT automated. Sending KSh directly to a referrer's
// M-Pesa number requires Safaricom's B2C API, which is a separate product
// from the C2B/STK Push this app already uses, and needs its own
// application and approval — not set up here. Until that's worth building,
// the flow is: run this script, pay each person manually via M-Pesa
// (send money to their phone), then run "mark" to record it.
async function main() {
  const [, , command, arg] = process.argv;

  if (command === 'mark') {
    if (!arg) {
      console.log('Usage: node scripts/pay-referrals.js mark <userId>');
      process.exit(1);
    }
    const result = await pool.query(
      `UPDATE referral_earnings SET status = 'paid_out', paid_out_at = now()
       WHERE referrer_id = $1 AND status = 'earned'
       RETURNING id, reward_amount_kes`,
      [arg]
    );
    console.log(`Marked ${result.rows.length} earning(s) as paid for user ${arg}.`);
    await pool.end();
    return;
  }

  const result = await pool.query(`
    SELECT u.id, u.name, u.email, u.phone,
           COUNT(re.id)::int AS pending_count,
           SUM(re.reward_amount_kes) AS pending_total_kes
    FROM referral_earnings re
    JOIN users u ON u.id = re.referrer_id
    WHERE re.status = 'earned'
    GROUP BY u.id, u.name, u.email, u.phone
    ORDER BY pending_total_kes DESC
  `);

  if (!result.rows.length) {
    console.log('No pending referral payouts.');
  } else {
    console.log('Pending referral payouts:\n');
    for (const row of result.rows) {
      console.log(
        `${row.name} (${row.email})${row.phone ? ' — ' + row.phone : ' — no phone on file, check their M-Pesa payment records'}\n` +
        `  ${row.pending_count} referral(s), KSh ${row.pending_total_kes} owed\n` +
        `  Mark paid after sending: node scripts/pay-referrals.js mark ${row.id}\n`
      );
    }
    const total = result.rows.reduce((sum, r) => sum + Number(r.pending_total_kes), 0);
    console.log(`Total pending across all referrers: KSh ${total}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('pay-referrals.js error:', err.message);
  process.exit(1);
});

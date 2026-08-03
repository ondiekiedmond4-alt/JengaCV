const express = require('express');
const pool = require('../db');
const { stkPush } = require('../daraja');
const pesapal = require('../pesapal');
const { requireAuth } = require('../auth');

const router = express.Router();
const DOWNLOAD_PRICE = 500;
const CREDITS_PER_PAYMENT = 3;

// Kick off an M-Pesa STK push for KSh 500, for the logged-in user.
router.post('/mpesa/stkpush', requireAuth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const callbackUrl = `${process.env.CALLBACK_BASE_URL}/api/mpesa/callback`;

    const darajaRes = await stkPush({
      phone,
      amount: DOWNLOAD_PRICE,
      accountReference: `JengaCV-${req.userId}`,
      transactionDesc: '3 CV downloads',
      callbackUrl,
    });

    await pool.query(
      `INSERT INTO payments (user_id, provider, checkout_request_id, merchant_request_id, amount, phone_number, status)
       VALUES ($1, 'mpesa', $2, $3, $4, $5, 'pending')`,
      [req.userId, darajaRes.CheckoutRequestID, darajaRes.MerchantRequestID, DOWNLOAD_PRICE, phone]
    );

    res.json({ checkoutRequestId: darajaRes.CheckoutRequestID });
  } catch (err) {
    console.error('mpesa/stkpush error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not start M-Pesa payment. Please try again.' });
  }
});

// Safaricom calls this after the user enters their PIN (or cancels/times out).
// This is the ONLY place M-Pesa credits are ever granted — never trust the frontend.
// Not behind requireAuth: Safaricom is the caller here, not a logged-in browser.
router.post('/mpesa/callback', async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.status(400).json({ error: 'Malformed callback' });

    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;

    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE checkout_request_id = $1',
      [CheckoutRequestID]
    );
    if (!paymentResult.rows.length) {
      // Acknowledge anyway so Safaricom doesn't retry indefinitely.
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    const payment = paymentResult.rows[0];

    if (ResultCode === 0) {
      await pool.query(
        `UPDATE payments SET status = 'success', credits_granted = $1, result_code = $2,
         result_desc = $3, raw_callback = $4, confirmed_at = now() WHERE id = $5`,
        [CREDITS_PER_PAYMENT, ResultCode, ResultDesc, JSON.stringify(req.body), payment.id]
      );
      await pool.query(
        'UPDATE users SET downloads_remaining = downloads_remaining + $1, updated_at = now() WHERE id = $2',
        [CREDITS_PER_PAYMENT, payment.user_id]
      );
    } else {
      await pool.query(
        `UPDATE payments SET status = 'failed', result_code = $1, result_desc = $2,
         raw_callback = $3 WHERE id = $4`,
        [ResultCode, ResultDesc, JSON.stringify(req.body), payment.id]
      );
    }

    // Daraja expects this exact acknowledgment shape.
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('mpesa/callback error:', err.message);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Server error' });
  }
});

// ---------------- Card payments (Pesapal) ----------------

// Start a hosted checkout order for the logged-in user. Returns a
// redirect_url the frontend opens in a new tab; the user pays there,
// Pesapal never touches our server with card details directly.
router.post('/pesapal/initiate', requireAuth, async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) return res.status(400).json({ error: 'email or phone is required' });

    // Create the payment row first so we have a merchant reference to hand to Pesapal.
    const paymentInsert = await pool.query(
      `INSERT INTO payments (user_id, provider, amount, phone_number, status)
       VALUES ($1, 'card', $2, $3, 'pending') RETURNING id`,
      [req.userId, DOWNLOAD_PRICE, phone || null]
    );
    const paymentId = paymentInsert.rows[0].id;

    const order = await pesapal.submitOrder({
      merchantReference: paymentId,
      amount: DOWNLOAD_PRICE,
      description: '3 CV downloads',
      callbackUrl: `${process.env.CALLBACK_BASE_URL}/pesapal-callback.html`,
      ipnUrl: `${process.env.CALLBACK_BASE_URL}/api/pesapal/ipn`,
      email,
      phone,
    });

    await pool.query(
      'UPDATE payments SET checkout_request_id = $1, merchant_request_id = $2 WHERE id = $3',
      [order.order_tracking_id, order.merchant_reference, paymentId]
    );

    res.json({ orderTrackingId: order.order_tracking_id, redirectUrl: order.redirect_url });
  } catch (err) {
    console.error('pesapal/initiate error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not start card payment. Please try again.' });
  }
});

// Shared by the IPN webhook and the callback-page fallback below, so both
// paths update the payment/credits the same way, idempotently.
async function reconcilePesapalPayment(orderTrackingId) {
  const paymentResult = await pool.query(
    'SELECT * FROM payments WHERE checkout_request_id = $1',
    [orderTrackingId]
  );
  if (!paymentResult.rows.length) return null;
  const payment = paymentResult.rows[0];

  // Already settled (e.g. IPN and the callback page both fired) — don't double-credit.
  if (payment.status !== 'pending') return payment;

  const statusRes = await pesapal.getTransactionStatus(orderTrackingId);
  const desc = statusRes.payment_status_description; // COMPLETED | FAILED | INVALID | PENDING

  if (desc === 'COMPLETED') {
    await pool.query(
      `UPDATE payments SET status = 'success', credits_granted = $1, result_desc = $2,
       raw_callback = $3, confirmed_at = now() WHERE id = $4`,
      [CREDITS_PER_PAYMENT, desc, JSON.stringify(statusRes), payment.id]
    );
    await pool.query(
      'UPDATE users SET downloads_remaining = downloads_remaining + $1, updated_at = now() WHERE id = $2',
      [CREDITS_PER_PAYMENT, payment.user_id]
    );
  } else if (desc === 'FAILED' || desc === 'INVALID') {
    await pool.query(
      `UPDATE payments SET status = 'failed', result_desc = $1, raw_callback = $2 WHERE id = $3`,
      [desc, JSON.stringify(statusRes), payment.id]
    );
  }
  // If still PENDING, leave the row as-is — caller will check again later.

  const refreshed = await pool.query('SELECT * FROM payments WHERE id = $1', [payment.id]);
  return refreshed.rows[0];
}

// Pesapal's server-to-server notification. This — not the browser redirect
// below — is the authoritative confirmation. Not behind requireAuth: Pesapal
// is the caller here, not a logged-in browser.
router.get('/pesapal/ipn', async (req, res) => {
  const { OrderTrackingId, OrderNotificationType, OrderMerchantReference } = req.query;
  try {
    if (OrderTrackingId) await reconcilePesapalPayment(OrderTrackingId);
  } catch (err) {
    console.error('pesapal/ipn error:', err.response?.data || err.message);
    // Still acknowledge below — Pesapal will retry the IPN, and our /confirm
    // fallback covers the gap in the meantime.
  }
  // Pesapal requires exactly this response shape to consider the IPN delivered.
  res.json({
    orderNotificationType: OrderNotificationType,
    orderTrackingId: OrderTrackingId,
    orderMerchantReference: OrderMerchantReference,
    status: 200,
  });
});

// Called by pesapal-callback.html right after the browser redirects back
// from checkout — a fast-path in case the IPN hasn't landed yet. Safe to
// call repeatedly; reconcilePesapalPayment() only credits once. Not behind
// requireAuth: this page loads in a fresh tab Pesapal controls, and the
// orderTrackingId itself is the effective credential here.
router.get('/pesapal/confirm/:orderTrackingId', async (req, res) => {
  try {
    const payment = await reconcilePesapalPayment(req.params.orderTrackingId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    const userResult = await pool.query('SELECT downloads_remaining FROM users WHERE id = $1', [payment.user_id]);
    res.json({ status: payment.status, downloadsRemaining: userResult.rows[0]?.downloads_remaining ?? 0 });
  } catch (err) {
    console.error('pesapal/confirm error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not confirm payment status' });
  }
});

// Frontend polls this while waiting for payment confirmation (either M-Pesa
// PIN entry or the Pesapal checkout tab). Requires auth, and only returns
// status for a payment that actually belongs to the logged-in user.
router.get('/payments/status/:checkoutRequestId', requireAuth, async (req, res) => {
  try {
    const initial = await pool.query(
      `SELECT p.id, p.user_id, p.provider, p.status, u.downloads_remaining FROM payments p
       JOIN users u ON u.id = p.user_id
       WHERE p.checkout_request_id = $1`,
      [req.params.checkoutRequestId]
    );
    if (!initial.rows.length) return res.status(404).json({ error: 'Payment not found' });

    let row = initial.rows[0];
    if (row.user_id !== req.userId) {
      return res.status(403).json({ error: 'This payment does not belong to your account' });
    }

    // M-Pesa is confirmed purely by the callback webhook — nothing to do here.
    // Card payments can be safely re-checked against Pesapal on every poll,
    // so we don't have to wait on the IPN or the callback page alone.
    if (row.provider === 'card' && row.status === 'pending') {
      const updated = await reconcilePesapalPayment(req.params.checkoutRequestId);
      if (updated) {
        const refreshedUser = await pool.query('SELECT downloads_remaining FROM users WHERE id = $1', [updated.user_id]);
        row = { status: updated.status, downloads_remaining: refreshedUser.rows[0]?.downloads_remaining ?? row.downloads_remaining };
      }
    }

    res.json({
      status: row.status,
      downloadsRemaining: row.downloads_remaining,
    });
  } catch (err) {
    console.error('payments/status error:', err.message);
    res.status(500).json({ error: 'Could not check payment status' });
  }
});

// Consumes one download credit for the logged-in user. Called right before
// the frontend triggers window.print().
router.post('/downloads/consume', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      'SELECT * FROM users WHERE id = $1 FOR UPDATE',
      [req.userId]
    );
    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }
    const user = userResult.rows[0];
    if (user.downloads_remaining <= 0) {
      await client.query('ROLLBACK');
      return res.status(402).json({ error: 'No downloads remaining. Please pay to unlock more.' });
    }

    const updated = await client.query(
      'UPDATE users SET downloads_remaining = downloads_remaining - 1, updated_at = now() WHERE id = $1 RETURNING downloads_remaining',
      [user.id]
    );
    await client.query('INSERT INTO downloads (user_id) VALUES ($1)', [user.id]);
    await client.query('COMMIT');

    res.json({ downloadsRemaining: updated.rows[0].downloads_remaining });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('downloads/consume error:', err.message);
    res.status(500).json({ error: 'Could not process download' });
  } finally {
    client.release();
  }
});

module.exports = router;

const axios = require('axios');

const isSandbox = (process.env.PESAPAL_ENV || 'sandbox') === 'sandbox';
const BASE_URL = isSandbox
  ? 'https://cybqa.pesapal.com/pesapalv3'
  : 'https://pay.pesapal.com/v3';

let cachedToken = null;
let cachedTokenExpiry = 0;
let cachedIpnId = process.env.PESAPAL_IPN_ID || null; // can be pre-set to skip re-registering

// Pesapal tokens are short-lived (~5 min); cache to avoid hammering the auth endpoint.
async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const res = await axios.post(`${BASE_URL}/api/Auth/RequestToken`, {
    consumer_key: process.env.PESAPAL_CONSUMER_KEY,
    consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
  });

  if (!res.data.token) {
    throw new Error(`Pesapal auth failed: ${JSON.stringify(res.data)}`);
  }

  cachedToken = res.data.token;
  cachedTokenExpiry = Date.now() + 4.5 * 60 * 1000; // refresh 30s early
  return cachedToken;
}

// Pesapal needs a registered IPN (webhook) URL before it will accept orders.
// This only needs to run once per Pesapal account, but re-registering is
// harmless (it just returns a fresh ipn_id), so we cache in-process and
// re-register automatically if the server restarts.
async function getOrRegisterIpnId(ipnUrl) {
  if (cachedIpnId) return cachedIpnId;

  const token = await getAccessToken();
  const res = await axios.post(
    `${BASE_URL}/api/URLSetup/RegisterIPN`,
    { url: ipnUrl, ipn_notification_type: 'GET' },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.data.ipn_id) {
    throw new Error(`Pesapal IPN registration failed: ${JSON.stringify(res.data)}`);
  }
  cachedIpnId = res.data.ipn_id;
  return cachedIpnId;
}

async function submitOrder({ merchantReference, amount, description, callbackUrl, ipnUrl, email, phone }) {
  const token = await getAccessToken();
  const notificationId = await getOrRegisterIpnId(ipnUrl);

  const res = await axios.post(
    `${BASE_URL}/api/Transactions/SubmitOrderRequest`,
    {
      id: merchantReference,
      currency: 'KES',
      amount,
      description,
      callback_url: callbackUrl,
      notification_id: notificationId,
      billing_address: {
        email_address: email || undefined,
        phone_number: phone || undefined,
        country_code: 'KE',
      },
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.data.error) {
    throw new Error(`Pesapal order submission failed: ${JSON.stringify(res.data.error)}`);
  }
  return res.data; // { order_tracking_id, redirect_url, merchant_reference }
}

async function getTransactionStatus(orderTrackingId) {
  const token = await getAccessToken();
  const res = await axios.get(
    `${BASE_URL}/api/Transactions/GetTransactionStatus`,
    {
      params: { orderTrackingId },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.data; // includes payment_status_description: COMPLETED | FAILED | INVALID | PENDING
}

module.exports = { submitOrder, getTransactionStatus, getOrRegisterIpnId };

const axios = require('axios');

const isSandbox = (process.env.DARAJA_ENV || 'sandbox') === 'sandbox';
const BASE_URL = isSandbox
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

let cachedToken = null;
let cachedTokenExpiry = 0;

// OAuth tokens are valid ~1hr; cache to avoid hitting the rate limit on every request.
async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const auth = Buffer.from(
    `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`
  ).toString('base64');

  const res = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  cachedToken = res.data.access_token;
  cachedTokenExpiry = Date.now() + 55 * 60 * 1000; // refresh 5 min early
  return cachedToken;
}

function timestampNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// Normalizes Kenyan numbers to the 2547XXXXXXXX format Daraja requires.
function normalizePhone(phone) {
  let p = phone.replace(/\s|-/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  return p;
}

async function stkPush({ phone, amount, accountReference, transactionDesc, callbackUrl }) {
  const token = await getAccessToken();
  const timestamp = timestampNow();
  const shortcode = process.env.DARAJA_SHORTCODE;
  const password = Buffer.from(
    `${shortcode}${process.env.DARAJA_PASSKEY}${timestamp}`
  ).toString('base64');
  const msisdn = normalizePhone(phone);

  const res = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: msisdn,
      PartyB: shortcode,
      PhoneNumber: msisdn,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return res.data; // includes CheckoutRequestID, MerchantRequestID
}

module.exports = { getAccessToken, stkPush, normalizePhone };

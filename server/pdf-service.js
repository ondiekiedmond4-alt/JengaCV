const axios = require('axios');

const CUSTOMJS_URL = 'https://e.customjs.io/html2pdf';

/**
 * Converts an HTML string to a PDF buffer via CustomJS's hosted API.
 * Uses real Chromium rendering server-side, so output is sharp/vector —
 * not a rasterized "scanned" look — and works identically on every device,
 * since the browser never has to generate the file itself.
 */
async function htmlToPdf(html) {
  if (!process.env.CUSTOMJS_API_KEY) {
    const err = new Error('PDF generation is not configured (CUSTOMJS_API_KEY missing).');
    err.notConfigured = true;
    throw err;
  }

  const res = await axios.post(
    CUSTOMJS_URL,
    { input: { html } },
    {
      headers: {
        'x-api-key': process.env.CUSTOMJS_API_KEY,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    }
  );

  return Buffer.from(res.data);
}

module.exports = { htmlToPdf };

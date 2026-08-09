const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');
const { signToken, requireAuth } = require('../auth');
const { sendEmail } = require('../email');

const router = express.Router();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function sendVerificationEmail(userId, email, name) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    'INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

  const verifyUrl = `${process.env.CALLBACK_BASE_URL}/verify-email.html?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: 'Verify your JengaCV email',
    html: `<p>Hi ${name || 'there'},</p>
           <p>Please confirm this is your email address by clicking below. This link expires in 24 hours.</p>
           <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    text: `Verify your JengaCV email: ${verifyUrl} (expires in 24 hours).`,
  });
}

// Excludes visually ambiguous characters (0/O, 1/I/L) so codes are easy to
// read aloud or retype from a screenshot.
const REFERRAL_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateReferralCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)];
  return code;
}
async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    const existing = await pool.query('SELECT id FROM users WHERE referral_code = $1', [code]);
    if (!existing.rows.length) return code;
  }
  throw new Error('Could not generate a unique referral code after 10 attempts');
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, marketingOptIn, referralCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
    }

    // If a referral code was passed in, look up who it belongs to. An
    // invalid/unknown code is silently ignored rather than blocking
    // registration — referral attribution is a nice-to-have, not a
    // required field.
    let referredBy = null;
    if (referralCode) {
      const referrerResult = await pool.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [referralCode.trim().toUpperCase()]
      );
      if (referrerResult.rows.length) referredBy = referrerResult.rows[0].id;
    }

    const newReferralCode = await generateUniqueReferralCode();
    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await pool.query(
      `INSERT INTO users (email, password_hash, name, marketing_opt_in, referral_code, referred_by, downloads_remaining)
       VALUES ($1, $2, $3, $4, $5, $6, 0) RETURNING id, name, downloads_remaining, marketing_opt_in, referral_code, email_verified, is_admin`,
      [normalizedEmail, passwordHash, name.trim(), !!marketingOptIn, newReferralCode, referredBy]
    );
    const user = inserted.rows[0];

    try {
      await sendVerificationEmail(user.id, normalizedEmail, user.name);
    } catch (emailErr) {
      // Don't fail account creation just because the verification email
      // didn't send — the user can request another from inside the app.
      console.error('registration verification email error:', emailErr.response?.data || emailErr.message);
    }

    const token = signToken(user.id);
    res.json({
      token,
      name: user.name,
      downloadsRemaining: user.downloads_remaining,
      marketingOptIn: user.marketing_opt_in,
      referralCode: user.referral_code,
      emailVerified: user.email_verified,
      isAdmin: user.is_admin,
    });
  } catch (err) {
    console.error('auth/register error:', err.message);
    res.status(500).json({ error: 'Could not create your account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    // Deliberately generic error for both "no such user" and "wrong password" —
    // avoids revealing which emails are registered.
    if (!result.rows.length || !result.rows[0].password_hash) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const token = signToken(user.id);
    res.json({
      token,
      name: user.name,
      downloadsRemaining: user.downloads_remaining,
      marketingOptIn: user.marketing_opt_in,
      referralCode: user.referral_code,
      emailVerified: user.email_verified,
      isAdmin: user.is_admin,
    });
  } catch (err) {
    console.error('auth/login error:', err.message);
    res.status(500).json({ error: 'Could not log you in. Please try again.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, email, downloads_remaining, marketing_opt_in, referral_code, email_verified, is_admin FROM users WHERE id = $1',
      [req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Account not found.' });
    const user = result.rows[0];
    res.json({
      name: user.name,
      email: user.email,
      downloadsRemaining: user.downloads_remaining,
      marketingOptIn: user.marketing_opt_in,
      referralCode: user.referral_code,
      emailVerified: user.email_verified,
      isAdmin: user.is_admin,
    });
  } catch (err) {
    console.error('auth/me error:', err.message);
    res.status(500).json({ error: 'Could not load your account.' });
  }
});

// Resend the verification email — used when the in-app banner's "resend" link is clicked.
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT email, name, email_verified FROM users WHERE id = $1', [req.userId]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'Account not found.' });
    const user = userResult.rows[0];
    if (user.email_verified) return res.json({ message: 'Your email is already verified.' });

    await sendVerificationEmail(req.userId, user.email, user.name);
    res.json({ message: 'Verification email sent — check your inbox.' });
  } catch (err) {
    console.error('auth/resend-verification error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not send verification email. Please try again.' });
  }
});

// Public — reached by clicking the link in the verification email.
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Verification token is required.' });

    const tokenHash = hashToken(token);
    const result = await pool.query(
      `SELECT * FROM email_verifications WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'This verification link is invalid or has expired. Please request a new one.' });
    }
    const record = result.rows[0];

    await pool.query('UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1', [record.user_id]);
    await pool.query('UPDATE email_verifications SET used_at = now() WHERE id = $1', [record.id]);

    res.json({ message: 'Your email has been verified.' });
  } catch (err) {
    console.error('auth/verify-email error:', err.message);
    res.status(500).json({ error: 'Could not verify your email. Please try again.' });
  }
});

// Update whether the logged-in user wants promotional emails. Separate from
// registration so people can change their mind anytime from account settings.
router.patch('/marketing-preference', requireAuth, async (req, res) => {
  try {
    const { optIn } = req.body;
    const result = await pool.query(
      'UPDATE users SET marketing_opt_in = $1, updated_at = now() WHERE id = $2 RETURNING marketing_opt_in',
      [!!optIn, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Account not found.' });
    res.json({ marketingOptIn: result.rows[0].marketing_opt_in });
  } catch (err) {
    console.error('auth/marketing-preference error:', err.message);
    res.status(500).json({ error: 'Could not update your preference.' });
  }
});

// Request a password reset link. Always responds the same way whether or
// not the email is registered, so this can't be used to check which emails
// have accounts.
router.post('/forgot-password', async (req, res) => {
  const genericResponse = { message: 'If an account exists for that email, a reset link has been sent.' };
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const normalizedEmail = email.trim().toLowerCase();

    const userResult = await pool.query('SELECT id, name FROM users WHERE email = $1', [normalizedEmail]);
    if (userResult.rows.length) {
      const user = userResult.rows[0];
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await pool.query(
        'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      const resetUrl = `${process.env.CALLBACK_BASE_URL}/reset-password.html?token=${rawToken}`;
      try {
        await sendEmail({
          to: normalizedEmail,
          subject: 'Reset your JengaCV password',
          html: `<p>Hi ${user.name || 'there'},</p>
                 <p>We received a request to reset your JengaCV password. This link expires in 1 hour:</p>
                 <p><a href="${resetUrl}">${resetUrl}</a></p>
                 <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
          text: `Reset your JengaCV password: ${resetUrl} (expires in 1 hour). If you didn't request this, ignore this email.`,
        });
      } catch (emailErr) {
        // Don't leak send failures to the client — log and still return the generic response.
        console.error('forgot-password email send error:', emailErr.response?.data || emailErr.message);
      }
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('auth/forgot-password error:', err.message);
    // Still respond generically even on unexpected errors, for the same reason as above.
    res.json(genericResponse);
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const tokenHash = hashToken(token);
    const resetResult = await pool.query(
      `SELECT * FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash]
    );
    if (!resetResult.rows.length) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }
    const reset = resetResult.rows[0];

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
      passwordHash,
      reset.user_id,
    ]);

    // Mark this token used, and invalidate any other outstanding reset
    // tokens for the same account (e.g. from earlier abandoned requests).
    await pool.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [
      reset.user_id,
    ]);

    res.json({ message: 'Your password has been updated. You can now log in.' });
  } catch (err) {
    console.error('auth/reset-password error:', err.message);
    res.status(500).json({ error: 'Could not reset your password. Please try again.' });
  }
});

module.exports = router;

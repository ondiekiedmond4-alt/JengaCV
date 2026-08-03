const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.warn(
    'WARNING: JWT_SECRET is not set. Sessions will not be secure and will ' +
    'break on every restart. Set JWT_SECRET in your environment (Render can ' +
    'generate one for you — see render.yaml).'
  );
}
// Falls back to a dev-only value so local testing doesn't hard-crash, but
// this fallback must never be relied on in a real deployment.
const EFFECTIVE_SECRET = SECRET || 'insecure-dev-fallback-do-not-use-in-production';

function signToken(userId) {
  return jwt.sign({ userId }, EFFECTIVE_SECRET, { expiresIn: '30d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' });
  try {
    const payload = jwt.verify(token, EFFECTIVE_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

module.exports = { signToken, requireAuth };

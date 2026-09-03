const express = require('express');
const db = require('../db');
const auth = require('../auth');

const RESET_DISABLED = {
  error: 'password_reset_disabled',
  message:
    'Unauthenticated password reset is no longer available. Sign in and change your password in Settings.',
};

function passwordRoutes(authenticateToken) {
  const router = express.Router();

  router.post('/reset-password', (req, res) => {
    res.status(410).json(RESET_DISABLED);
  });

  router.post('/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required',
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.sendStatus(404);
      const ok = await auth.comparePassword(currentPassword, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const passwordHash = await auth.hashPassword(newPassword);
      db.prepare(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(passwordHash, user.id);
      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error('POST /api/auth/change-password - error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = passwordRoutes;

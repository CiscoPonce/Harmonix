const express = require('express');
const auth = require('../auth');
const profileService = require('../services/profileService');

const router = express.Router();

const rawAvatarParser = express.raw({
  type: ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'],
  limit: '512kb',
});

router.patch('/profile', (req, res) => {
  if (!req.user?.id) return res.sendStatus(401);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const hasUsername = Object.prototype.hasOwnProperty.call(body, 'username');
  const hasBio = Object.prototype.hasOwnProperty.call(body, 'bio');

  if (!hasUsername && !hasBio) {
    return res.status(400).json({
      error: 'Nothing to update.',
      code: 'empty_profile',
    });
  }

  const patch = {};
  if (hasUsername) patch.username = body.username;
  if (hasBio) patch.bio = body.bio;

  try {
    const updated = profileService.saveProfile(req.user.id, patch);
    if (!updated) return res.sendStatus(404);
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof profileService.ProfileError) {
      return res.status(err.status).json({
        error: err.message,
        code: err.code,
      });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/avatar', rawAvatarParser, (req, res) => {
  if (!req.user?.id) return res.sendStatus(401);
  const buf = Buffer.isBuffer(req.body) ? req.body : null;
  const mime = buf ? profileService.sniffImage(buf) : null;
  if (!mime) {
    return res.status(400).json({
      error: 'Use a JPEG, PNG, or WebP image under 512 KB.',
      code: 'avatar_invalid',
    });
  }
  profileService.saveAvatar(req.user.id, buf, mime);
  return res.sendStatus(204);
});

router.get('/avatar', (req, res) => {
  if (!req.user?.id) return res.sendStatus(401);
  const avatar = profileService.readAvatar(req.user.id);
  if (!avatar) return res.sendStatus(404);
  res.set({
    'Content-Type': avatar.mime,
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  return res.status(200).send(avatar.bytes);
});

router.delete('/avatar', (req, res) => {
  if (!req.user?.id) return res.sendStatus(401);
  profileService.deleteAvatar(req.user.id);
  return res.sendStatus(204);
});

router.delete('/account', (req, res) => {
  if (!req.user?.id) return res.sendStatus(401);
  const deleted = profileService.deleteAccount(req.user.id);
  if (!deleted) return res.sendStatus(404);
  const cookieOpts = { ...auth.authCookieOptions(req) };
  delete cookieOpts.maxAge;
  res.clearCookie('refreshToken', cookieOpts);
  return res.sendStatus(204);
});

module.exports = router;

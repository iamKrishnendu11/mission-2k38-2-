const User = require('../models/User');
const { verifyAccessToken } = require('../utils/jwt');

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const userId = decoded?.id || decoded?.userId;
    if (!decoded || !userId) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    const uid = (user._id || user.id || userId).toString();
    req.userId = uid;
    if (req.user) {
      req.user.userId = uid;
      req.user._id = uid;
      req.user.id = uid;
    }

    if (typeof next === 'function') {
      return next();
    }

    return res.status(200).json({ user });
  } catch (error) {
    if (typeof next === 'function') {
      return next(error);
    }

    return res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}

module.exports = auth;

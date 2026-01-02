import db from '../db/index.js';

/**
 * Authentication middleware - requires valid session to access protected routes
 */
export const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * Admin middleware - requires authenticated user with is_admin = 1
 * Must be used after requireAuth
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.get(
      'SELECT is_admin FROM users WHERE id = ?',
      req.session.userId
    );

    if (!user || user.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    next();
  } catch (err) {
    next(err);
  }
};

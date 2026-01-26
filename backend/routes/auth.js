import express from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import db from '../db/index.js';

const router = express.Router();
const SALT_ROUNDS = 12;

// Rate limiter for login endpoint: 5 attempts per 5 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for register endpoint: 10 attempts per 15 minutes per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many registration attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules
const usernameRules = body('username')
  .trim()
  .isLength({ min: 3, max: 32 })
  .withMessage('Username must be between 3 and 32 characters')
  .matches(/^[a-zA-Z0-9._-]+$/)
  .withMessage('Username can only contain letters, numbers, dots, underscores, and hyphens');

const passwordRules = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters');

/**
 * Helper to regenerate session (prevents session fixation)
 */
function regenerateSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }
      req.session.userId = userId;
      resolve();
    });
  });
}

/**
 * GET /api/auth/status
 * Returns whether users exist and if registration is allowed
 */
router.get('/status', async (req, res, next) => {
  try {
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    const hasUsers = userCount.count > 0;
    
    // Check database setting first, then env var as override
    let registrationAllowed = !hasUsers; // Always allow if no users
    
    if (hasUsers) {
      const dbSetting = await db.get("SELECT value FROM app_settings WHERE key = 'allow_registration'");
      if (dbSetting) {
        // DB setting has priority
        registrationAllowed = dbSetting.value === 'true';
      } else {
        // Fallback to environment variable if setting not in DB
        registrationAllowed = process.env.ALLOW_REGISTRATION === 'true';
      }
    }
    
    res.json({ hasUsers, registrationAllowed });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns current user info or 401 if not authenticated
 */
router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const user = await db.get(
      'SELECT id, username, is_admin, created_at, last_login FROM users WHERE id = ?',
      req.session.userId
    );
    
    if (!user) {
      req.session.destroy();
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1,
      createdAt: user.created_at,
      lastLogin: user.last_login,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/register
 * Register a new user (first user becomes admin)
 * Uses transaction to prevent race condition for admin creation
 */
router.post(
  '/register',
  registerLimiter,
  [usernameRules, passwordRules],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      const { username, password } = req.body;
      
      // Hash password before transaction (CPU-intensive)
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      
      // Use transaction to prevent race condition for first admin
      let result;
      let isAdmin;
      
      try {
        await db.run('BEGIN IMMEDIATE');
        
        // Check if registration is allowed (inside transaction)
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        const hasUsers = userCount.count > 0;
        
        let registrationAllowed = !hasUsers;
        if (hasUsers) {
          const dbSetting = await db.get("SELECT value FROM app_settings WHERE key = 'allow_registration'");
          if (dbSetting) {
            registrationAllowed = dbSetting.value === 'true';
          } else {
            registrationAllowed = process.env.ALLOW_REGISTRATION === 'true';
          }
        }
        
        if (!registrationAllowed) {
          await db.run('ROLLBACK');
          return res.status(403).json({ error: 'Registration is disabled' });
        }
        
        // Check if username already exists
        const existingUser = await db.get('SELECT id FROM users WHERE username = ?', username);
        if (existingUser) {
          await db.run('ROLLBACK');
          return res.status(409).json({ error: 'Username already exists' });
        }
        
        // First user is admin (determined inside transaction)
        isAdmin = hasUsers ? 0 : 1;
        
        // Insert user
        result = await db.run(
          'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
          [username, passwordHash, isAdmin]
        );
        
        // Update last_login
        await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', result.lastID);
        
        await db.run('COMMIT');
      } catch (txErr) {
        await db.run('ROLLBACK').catch(() => {});
        throw txErr;
      }
      
      // Regenerate session to prevent session fixation
      await regenerateSession(req, result.lastID);
      
      res.status(201).json({
        id: result.lastID,
        username,
        isAdmin: isAdmin === 1,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post(
  '/login',
  loginLimiter,
  [usernameRules, passwordRules],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      const { username, password } = req.body;
      
      // Find user
      const user = await db.get(
        'SELECT id, username, password_hash, is_admin FROM users WHERE username = ?',
        username
      );
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Regenerate session to prevent session fixation
      await regenerateSession(req, user.id);
      
      // Update last_login
      await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', user.id);
      
      res.json({
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/logout
 * Destroy session and clear cookie
 */
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

export default router;

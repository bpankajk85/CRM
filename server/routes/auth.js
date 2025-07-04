import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    logger.info(`Login attempt for email: ${email}`);

    // Check if database is available
    try {
      const users = await query(`
        SELECT u.*, o.name as organization_name 
        FROM users u 
        JOIN organizations o ON u.organization_id = o.id 
        WHERE u.email = ? AND u.status = 'active'
      `, [email]);

      if (users.length === 0) {
        logger.warn(`Login failed - user not found: ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = users[0];
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        logger.warn(`Login failed - invalid password for: ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      try {
        await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
      } catch (updateError) {
        logger.warn('Failed to update last login:', updateError);
        // Don't fail login if update fails
      }

      const token = generateToken(user);

      // Log successful login
      try {
        await query(`
          INSERT INTO audit_logs (organization_id, user_id, action, ip_address, user_agent)
          VALUES (?, ?, 'user_login', ?, ?)
        `, [user.organization_id, user.id, req.ip, req.get('User-Agent')]);
      } catch (auditError) {
        logger.warn('Failed to log audit trail:', auditError);
        // Don't fail login if audit logging fails
      }

      logger.info(`Login successful for: ${email}`);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          organizationId: user.organization_id,
          organizationName: user.organization_name
        }
      });

    } catch (dbError) {
      logger.error('Database error during login:', dbError);
      
      // If it's a connection error, provide a more specific message
      if (dbError.code === 'ECONNREFUSED' || dbError.code === 'ER_ACCESS_DENIED_ERROR') {
        return res.status(503).json({ 
          error: 'Database connection error. Please try again later.' 
        });
      }
      
      return res.status(500).json({ error: 'Login failed due to server error' });
    }

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const users = await query(`
      SELECT u.*, o.name as organization_name 
      FROM users u 
      JOIN organizations o ON u.organization_id = o.id 
      WHERE u.id = ?
    `, [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      organizationId: user.organization_id,
      organizationName: user.organization_name,
      lastLogin: user.last_login
    });

  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    const users = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedNewPassword, req.user.id]);

    // Log password change
    try {
      await query(`
        INSERT INTO audit_logs (organization_id, user_id, action, ip_address, user_agent)
        VALUES (?, ?, 'password_changed', ?, ?)
      `, [req.user.organizationId, req.user.id, req.ip, req.get('User-Agent')]);
    } catch (auditError) {
      logger.warn('Failed to log password change:', auditError);
    }

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
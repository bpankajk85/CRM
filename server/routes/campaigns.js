import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { emailRateLimitMiddleware } from '../middleware/emailRateLimit.js';
import { EmailService } from '../services/emailService.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Get all campaigns
router.get('/', authenticateToken, requirePermission('send_campaigns'), async (req, res) => {
  try {
    const campaigns = await query(`
      SELECT 
        c.*,
        u.first_name, u.last_name,
        CASE 
          WHEN c.send_count > 0 THEN ROUND((c.open_count / c.send_count) * 100, 2)
          ELSE 0 
        END as open_rate,
        CASE 
          WHEN c.send_count > 0 THEN ROUND((c.click_count / c.send_count) * 100, 2)
          ELSE 0 
        END as click_rate
      FROM campaigns c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.organization_id = ?
      ORDER BY c.created_at DESC
    `, [req.user.organizationId]);

    res.json(campaigns);
  } catch (error) {
    logger.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Create campaign
router.post('/', authenticateToken, requirePermission('send_campaigns'), async (req, res) => {
  try {
    const { name, subject, content, listId } = req.body;

    if (!name || !subject || !content) {
      return res.status(400).json({ error: 'Name, subject, and content are required' });
    }

    const result = await query(`
      INSERT INTO campaigns (organization_id, name, subject, content, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.organizationId, name, subject, content, req.user.id]);

    res.status(201).json({ id: result.insertId, message: 'Campaign created successfully' });
  } catch (error) {
    logger.error('Create campaign error:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Send campaign
router.post('/:campaignId/send', 
  authenticateToken, 
  requirePermission('send_campaigns'),
  emailRateLimitMiddleware,
  async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { listId } = req.body;

      if (!listId) {
        return res.status(400).json({ error: 'Contact list ID is required' });
      }

      // Verify campaign belongs to organization
      const campaigns = await query(
        'SELECT * FROM campaigns WHERE id = ? AND organization_id = ?',
        [campaignId, req.user.organizationId]
      );

      if (campaigns.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Get contacts from the list
      const contacts = await query(`
        SELECT c.id, c.email, c.first_name, c.last_name
        FROM contacts c
        JOIN contact_list_members clm ON c.id = clm.contact_id
        WHERE clm.list_id = ? AND c.status = 'active' AND c.organization_id = ?
      `, [listId, req.user.organizationId]);

      if (contacts.length === 0) {
        return res.status(400).json({ error: 'No active contacts found in the selected list' });
      }

      // Start sending campaign (this will respect per-user rate limits)
      const result = await EmailService.sendCampaign(
        req.user.id,
        req.user.organizationId,
        campaignId,
        contacts
      );

      res.json({
        message: 'Campaign sending started',
        ...result
      });

    } catch (error) {
      logger.error('Send campaign error:', error);
      res.status(500).json({ error: error.message || 'Failed to send campaign' });
    }
  }
);

// Get email rate status for current user
router.get('/rate-status', authenticateToken, async (req, res) => {
  try {
    const status = await EmailService.getRateStatus(req.user.id);
    res.json(status);
  } catch (error) {
    logger.error('Get rate status error:', error);
    res.status(500).json({ error: 'Failed to get rate status' });
  }
});

// Send test email
router.post('/test-email', 
  authenticateToken, 
  requirePermission('send_campaigns'),
  emailRateLimitMiddleware,
  async (req, res) => {
    try {
      const { to, subject, content } = req.body;

      if (!to || !subject || !content) {
        return res.status(400).json({ error: 'To, subject, and content are required' });
      }

      const result = await EmailService.sendEmail(req.user.id, req.user.organizationId, {
        to,
        subject,
        html: content
      });

      res.json({
        message: 'Test email sent successfully',
        messageId: result.messageId
      });

    } catch (error) {
      logger.error('Send test email error:', error);
      res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
  }
);

export default router;
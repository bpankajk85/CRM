import nodemailer from 'nodemailer';
import { logger } from '../config/logger.js';
import { query } from '../config/database.js';
import { incrementEmailCount, checkEmailRateLimit } from '../middleware/emailRateLimit.js';

// Email service configuration
const transporter = nodemailer.createTransport({
  // Configure with your SMTP settings
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export class EmailService {
  static async sendEmail(userId, organizationId, emailData) {
    try {
      // Check rate limit before sending (per user)
      const rateCheck = checkEmailRateLimit(userId);
      
      if (!rateCheck.allowed) {
        throw new Error(`Email rate limit exceeded. Reset in ${Math.ceil(rateCheck.resetTime / 1000)} seconds`);
      }
      
      // Simulate email sending (replace with actual SMTP sending)
      const result = await this.simulateEmailSend(emailData);
      
      // Increment the email count after successful send
      incrementEmailCount(userId);
      
      // Log the email event
      await this.logEmailEvent(organizationId, emailData, result);
      
      logger.info(`Email sent successfully to ${emailData.to}`, {
        userId,
        organizationId,
        subject: emailData.subject,
        remaining: rateCheck.remaining - 1
      });
      
      return result;
      
    } catch (error) {
      logger.error('Email sending failed:', error);
      throw error;
    }
  }
  
  static async simulateEmailSend(emailData) {
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate success/failure (95% success rate)
    const success = Math.random() > 0.05;
    
    if (!success) {
      throw new Error('Simulated email delivery failure');
    }
    
    return {
      messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'sent',
      timestamp: new Date()
    };
  }
  
  static async logEmailEvent(organizationId, emailData, result) {
    try {
      // Find contact by email
      const contacts = await query(
        'SELECT id FROM contacts WHERE email = ? AND organization_id = ?',
        [emailData.to, organizationId]
      );
      
      if (contacts.length > 0) {
        await query(`
          INSERT INTO email_events (
            organization_id, contact_id, event_type, timestamp, metadata
          ) VALUES (?, ?, 'sent', NOW(), ?)
        `, [
          organizationId,
          contacts[0].id,
          JSON.stringify({
            messageId: result.messageId,
            subject: emailData.subject
          })
        ]);
      }
    } catch (error) {
      logger.error('Failed to log email event:', error);
    }
  }
  
  static async sendCampaign(userId, organizationId, campaignId, contactList) {
    try {
      const campaign = await query(
        'SELECT * FROM campaigns WHERE id = ? AND organization_id = ?',
        [campaignId, organizationId]
      );
      
      if (campaign.length === 0) {
        throw new Error('Campaign not found');
      }
      
      const campaignData = campaign[0];
      let sentCount = 0;
      let failedCount = 0;
      
      // Send emails to each contact with rate limiting
      for (const contact of contactList) {
        try {
          await this.sendEmail(userId, organizationId, {
            to: contact.email,
            subject: campaignData.subject,
            html: campaignData.content,
            campaignId: campaignId
          });
          
          sentCount++;
          
          // Add delay between emails to respect rate limiting
          await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay
          
        } catch (error) {
          logger.error(`Failed to send email to ${contact.email}:`, error);
          failedCount++;
          
          // If rate limited, wait for reset
          if (error.message.includes('rate limit')) {
            const resetTime = parseInt(error.message.match(/(\d+) seconds/)?.[1] || '60');
            logger.info(`Rate limit hit, waiting ${resetTime} seconds...`);
            await new Promise(resolve => setTimeout(resolve, resetTime * 1000));
          }
        }
      }
      
      // Update campaign statistics
      await query(`
        UPDATE campaigns 
        SET send_count = ?, status = 'sent', sent_at = NOW()
        WHERE id = ?
      `, [sentCount, campaignId]);
      
      logger.info(`Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`);
      
      return {
        sent: sentCount,
        failed: failedCount,
        total: contactList.length
      };
      
    } catch (error) {
      logger.error('Campaign sending failed:', error);
      throw error;
    }
  }
  
  static async getRateStatus(userId) {
    const rateCheck = checkEmailRateLimit(userId);
    return {
      allowed: rateCheck.allowed,
      remaining: rateCheck.remaining,
      resetTime: Math.ceil(rateCheck.resetTime / 1000),
      limit: 2
    };
  }
}
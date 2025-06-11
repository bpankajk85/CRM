import { logger } from '../config/logger.js';

// Per-user email rate limiting - 2 emails per minute per user
const EMAIL_RATE_LIMIT = 2;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute in milliseconds

// In-memory store for rate limiting (in production, use Redis)
const emailRateStore = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of emailRateStore.entries()) {
    if (now - data.windowStart > RATE_WINDOW_MS * 2) {
      emailRateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkEmailRateLimit(userId) {
  const now = Date.now();
  const key = `user_${userId}`;
  
  let rateData = emailRateStore.get(key);
  
  if (!rateData || now - rateData.windowStart >= RATE_WINDOW_MS) {
    // Start new window
    rateData = {
      count: 0,
      windowStart: now
    };
    emailRateStore.set(key, rateData);
  }
  
  if (rateData.count >= EMAIL_RATE_LIMIT) {
    const timeUntilReset = RATE_WINDOW_MS - (now - rateData.windowStart);
    logger.warn(`Email rate limit exceeded for user ${userId}. Reset in ${Math.ceil(timeUntilReset / 1000)}s`);
    
    return {
      allowed: false,
      resetTime: timeUntilReset,
      remaining: 0
    };
  }
  
  return {
    allowed: true,
    resetTime: RATE_WINDOW_MS - (now - rateData.windowStart),
    remaining: EMAIL_RATE_LIMIT - rateData.count
  };
}

export function incrementEmailCount(userId) {
  const key = `user_${userId}`;
  const rateData = emailRateStore.get(key);
  
  if (rateData) {
    rateData.count++;
    emailRateStore.set(key, rateData);
    
    logger.info(`Email sent by user ${userId}. Count: ${rateData.count}/${EMAIL_RATE_LIMIT}`);
  }
}

export function getEmailRateStatus(userId) {
  const now = Date.now();
  const key = `user_${userId}`;
  const rateData = emailRateStore.get(key);
  
  if (!rateData || now - rateData.windowStart >= RATE_WINDOW_MS) {
    return {
      count: 0,
      limit: EMAIL_RATE_LIMIT,
      remaining: EMAIL_RATE_LIMIT,
      resetTime: RATE_WINDOW_MS
    };
  }
  
  return {
    count: rateData.count,
    limit: EMAIL_RATE_LIMIT,
    remaining: Math.max(0, EMAIL_RATE_LIMIT - rateData.count),
    resetTime: RATE_WINDOW_MS - (now - rateData.windowStart)
  };
}

// Middleware for API endpoints that send emails
export function emailRateLimitMiddleware(req, res, next) {
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'User authentication required' });
  }
  
  const rateCheck = checkEmailRateLimit(userId);
  
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Email rate limit exceeded',
      message: `Maximum ${EMAIL_RATE_LIMIT} emails per minute allowed per user`,
      resetTime: Math.ceil(rateCheck.resetTime / 1000),
      remaining: rateCheck.remaining
    });
  }
  
  // Add rate limit info to request for use in email sending
  req.emailRateLimit = rateCheck;
  next();
}
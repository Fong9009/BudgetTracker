import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

// Enhanced input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeString = (str: string): string => {
    return str
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=/gi, '')
      // Remove data: URLs
      .replace(/data:\s*[^;]*;base64,/gi, '')
      // Remove vbscript: protocol
      .replace(/vbscript:/gi, '')
      // Remove file: protocol
      .replace(/file:/gi, '')
      // Remove potential SQL injection patterns
      .replace(/('|"|;|--|\/\*|\*\/|xp_|sp_|exec|execute|insert|select|delete|update|drop|create|alter|declare)/gi, '')
      // Trim whitespace
      .trim();
  };

  // Sanitize request body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      } else if (Array.isArray(req.body[key])) {
        req.body[key] = req.body[key].map((item: any) => 
          typeof item === 'string' ? sanitizeString(item) : item
        );
      }
    });
  }
  
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    });
  }

  // Sanitize URL parameters
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeString(req.params[key]);
      }
    });
  }
  
  next();
};

// Validation middleware for common operations
export const validateTransaction = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('description').trim().isLength({ min: 1, max: 255 }).withMessage('Description must be between 1 and 255 characters'),
  body('date').isISO8601().withMessage('Date must be a valid ISO date'),
  body('type').isIn(['income', 'expense', 'transfer']).withMessage('Type must be income, expense, or transfer'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }
    next();
  }
];

export const validateAccount = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Account name must be between 1 and 100 characters'),
  body('balance').isFloat().withMessage('Balance must be a valid number'),
  body('type').isIn(['checking', 'savings', 'credit', 'investment', 'cash']).withMessage('Invalid account type'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }
    next();
  }
];

export const validateCategory = [
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Category name must be between 1 and 50 characters'),
  body('color').matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color'),
  body('icon').trim().isLength({ min: 1, max: 50 }).withMessage('Icon must be between 1 and 50 characters'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }
    next();
  }
];

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Request size validation
export const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    return res.status(413).json({ 
      message: 'Request entity too large',
      maxSize: '10MB'
    });
  }
  
  next();
};

// IP address validation (basic)
export const validateIP = (req: Request, res: Response, next: NextFunction) => {
  // Get IP from X-Forwarded-For header when behind a proxy, fallback to req.ip
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || req.connection.remoteAddress;
  
  // Basic IP validation
  if (!ip || ip === 'unknown') {
    return res.status(400).json({ message: 'Invalid IP address' });
  }
  
  next();
};

// Security logging middleware
export const securityLogging = (req: Request, res: Response, next: NextFunction) => {
  // Get IP from X-Forwarded-For header when behind a proxy, fallback to req.ip
  const forwardedIp = req.headers['x-forwarded-for']?.toString().split(',')[0];
  const ip = forwardedIp || req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const method = req.method;
  const path = req.path;
  
  // Log suspicious activities
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /union\s+select/i,
    /drop\s+table/i,
    /exec\s*\(/i,
    /eval\s*\(/i
  ];
  
  const requestBody = JSON.stringify(req.body);
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(requestBody) || pattern.test(path) || pattern.test(userAgent)
  );
  
  if (isSuspicious) {
    console.warn(`🚨 SUSPICIOUS ACTIVITY DETECTED:`, {
      ip,
      userAgent,
      method,
      path,
      body: requestBody,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// Rate limiting error handler
export const rateLimitErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ 
      message: 'Request entity too large',
      maxSize: '10MB'
    });
  }
  
  next(err);
}; 
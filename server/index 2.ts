import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import csrf from "csurf";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { connectToDatabase } from "./mongodb";
import { 
  sanitizeInput, 
  securityHeaders, 
  validateRequestSize, 
  validateIP,
  rateLimitErrorHandler,
  securityLogging
} from "./security";

const app = express();

// Trust proxy for accurate IP detection (needed for rate limiting behind load balancers)
app.set('trust proxy', 1);

// Security middleware with environment-specific CSP
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: isProduction 
        ? ["'self'", "ws:", "wss:", "https://cdnjs.cloudflare.com"]
        : ["'self'", "ws:", "wss:", "https://cdnjs.cloudflare.com", "http://localhost:*"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'http://localhost:5001']
    : ['http://localhost:5001', 'http://localhost:3000', 'http://127.0.0.1:5001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs
  message: {
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Get IP from X-Forwarded-For header when behind a proxy
    const forwardedIp = req.headers['x-forwarded-for']?.toString().split(',')[0];
    if (forwardedIp) {
      return ipKeyGenerator(forwardedIp);
    }
    // Use the built-in IP key generator for proper IPv6 handling
    return ipKeyGenerator(req.ip || req.connection.remoteAddress || 'unknown');
  },
});

// Apply rate limiting to all API routes
app.use('/api', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 attempts per 5 minutes per IP
  message: {
    message: 'Too many login attempts. Please try again in 5 minutes or reset your password.',
    retryAfter: 5 * 60, // 5 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Get IP from X-Forwarded-For header when behind a proxy
    const forwardedIp = req.headers['x-forwarded-for']?.toString().split(',')[0];
    if (forwardedIp) {
      return ipKeyGenerator(forwardedIp);
    }
    // Use the built-in IP key generator for proper IPv6 handling
    return ipKeyGenerator(req.ip || req.connection.remoteAddress || 'unknown');
  },
});

app.use('/api/auth', authLimiter);

// Security headers
app.use(securityHeaders);

// Request size validation
app.use(validateRequestSize);

// IP validation
app.use(validateIP);

// Security logging (before sanitization)
app.use(securityLogging);

// Input sanitization
app.use(sanitizeInput);

// Cookie parser middleware (required for CSRF)
app.use(cookieParser());

// Body parsing middleware with limits
app.use(express.json({ 
  limit: '10mb', // Reduced from 50mb for security
  verify: (req, res, buf) => {
    // Store raw body for potential signature verification
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: false, 
  limit: '10mb' 
}));

// CSRF protection for non-GET requests (excluding auth endpoints)
app.use('/api', (req: any, res: any, next: any) => {
  // Skip CSRF for authentication endpoints
  if (req.path.startsWith('/auth/')) {
    return next();
  }
  
  // Apply CSRF protection to other endpoints
  return csrf({ 
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    },
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
    value: (req: any) => {
      const token = req.headers['x-csrf-token'];
      return Array.isArray(token) ? token[0] : token || '';
    }
  })(req, res, next);
});

// Request logging middleware
app.use((req, res, next) => {
  // Add request ID for tracking
  (req as any).id = crypto.randomUUID();
  res.setHeader('X-Request-ID', (req as any).id);
  
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `[${(req as any).id}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Connect to MongoDB before starting the server
  await connectToDatabase();
  
  const server = await registerRoutes(app);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Railway health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // CSRF error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({ 
        message: 'CSRF token validation failed',
        error: 'Invalid or missing CSRF token'
      });
    }
    next(err);
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Rate limiting error handler
  app.use(rateLimitErrorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5001
  // this serves both the API and the client.
  const port = Number(process.env.PORT) || 5001;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();

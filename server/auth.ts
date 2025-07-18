import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import type { User as CustomUser } from "@shared/schema";

declare global {
  namespace Express {
    export interface User extends CustomUser {}
  }
}

export interface AuthenticatedRequest extends Request {
  user?: CustomUser;
}

export interface TokenPayload {
  userId: string;
  tokenId: string;
  type: 'access' | 'refresh';
}

const JWT_SECRET = process.env.JWT_SECRET || "your-default-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access tokens
const REFRESH_TOKEN_EXPIRY = '7d'; // Longer-lived refresh tokens

// In-memory token blacklist (in production, use Redis)
const tokenBlacklist = new Set<string>();

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateAccessToken = (userId: string, tokenId: string): string => {
  return jwt.sign(
    { userId, tokenId, type: 'access' } as TokenPayload, 
    JWT_SECRET, 
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

export const generateRefreshToken = (userId: string, tokenId: string): string => {
  return jwt.sign(
    { userId, tokenId, type: 'refresh' } as TokenPayload, 
    JWT_REFRESH_SECRET, 
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
};

export const generateTokenPair = (userId: string): { accessToken: string; refreshToken: string; tokenId: string } => {
  const tokenId = crypto.randomUUID();
  const accessToken = generateAccessToken(userId, tokenId);
  const refreshToken = generateRefreshToken(userId, tokenId);
  
  return { accessToken, refreshToken, tokenId };
};

export const blacklistToken = (token: string): void => {
  tokenBlacklist.add(token);
};

export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Check if token is blacklisted
    if (isTokenBlacklisted(token)) {
      return res.status(401).json({ message: "Token has been revoked" });
    }

    const decoded = verifyAccessToken(token);
    
    // Verify token type
    if (decoded.type !== 'access') {
      return res.status(401).json({ message: "Invalid token type" });
    }

    const user = await storage.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired", code: 'TOKEN_EXPIRED' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(401).json({ message: "Authentication failed" });
  }
};

export const refreshTokenMiddleware = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    // Check if refresh token is blacklisted
    if (isTokenBlacklisted(refreshToken)) {
      return res.status(401).json({ message: "Refresh token has been revoked" });
    }

    const decoded = verifyRefreshToken(refreshToken);
    
    // Verify token type
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: "Invalid token type" });
    }

    const user = await storage.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate new token pair
    const newTokenPair = generateTokenPair(decoded.userId);
    
    // Blacklist the old refresh token
    blacklistToken(refreshToken);

    res.json({
      accessToken: newTokenPair.accessToken,
      refreshToken: newTokenPair.refreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Refresh token expired" });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    res.status(500).json({ message: "Token refresh failed" });
  }
};

export const logoutMiddleware = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      blacklistToken(token);
    }
    
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
  }
};
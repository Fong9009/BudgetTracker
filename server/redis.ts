import Redis from 'ioredis';

// Redis configuration for token blacklisting
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
});

// Handle Redis connection events
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err: Error) => {
  console.error('❌ Redis connection error:', err);
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

// Token blacklist functions
export const blacklistToken = async (token: string, expiresIn: number = 86400): Promise<void> => {
  try {
    // Store token in Redis with expiration (default 24 hours)
    await redis.setex(`blacklist:${token}`, expiresIn, '1');
    console.log(`🔒 Token blacklisted: ${token.substring(0, 20)}...`);
  } catch (error) {
    console.error('❌ Failed to blacklist token:', error);
    // Fallback to in-memory storage if Redis fails
    fallbackBlacklist.add(token);
  }
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const result = await redis.get(`blacklist:${token}`);
    return result === '1';
  } catch (error) {
    console.error('❌ Failed to check token blacklist:', error);
    // Fallback to in-memory storage if Redis fails
    return fallbackBlacklist.has(token);
  }
};

// Fallback in-memory storage (for when Redis is unavailable)
const fallbackBlacklist = new Set<string>();

// Clean up expired tokens from in-memory storage
setInterval(() => {
  // This is a simple cleanup - in production, you'd want more sophisticated expiration
  if (fallbackBlacklist.size > 1000) {
    fallbackBlacklist.clear();
    console.log('🧹 Cleared fallback blacklist');
  }
}, 3600000); // Clean up every hour

// Health check function
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('❌ Redis health check failed:', error);
    return false;
  }
};

// Graceful shutdown
export const closeRedis = async (): Promise<void> => {
  try {
    await redis.quit();
    console.log('🔌 Redis connection closed gracefully');
  } catch (error) {
    console.error('❌ Error closing Redis connection:', error);
  }
};

export default redis; 
import fs from 'fs';
import path from 'path';

interface SecurityEvent {
  timestamp: string;
  eventType: 'login' | 'logout' | 'failed_login' | 'token_revoked' | 'rate_limit_exceeded' | 'suspicious_activity' | 'password_reset' | 'account_created';
  userId?: string;
  ip: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class SecurityLogger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'security.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLogEntry(event: SecurityEvent): string {
    return `[${event.timestamp}] [${event.severity.toUpperCase()}] [${event.eventType}] ${event.userId ? `User: ${event.userId}` : 'Anonymous'} | IP: ${event.ip} | UA: ${event.userAgent} | Details: ${JSON.stringify(event.details)}\n`;
  }

  async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    const logEntry = this.formatLogEntry(fullEvent);
    
    try {
      await fs.promises.appendFile(this.logFile, logEntry);
      
      // Also log to console for development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔒 Security Event: ${event.eventType} - ${event.severity}`);
      }
    } catch (error) {
      console.error('Failed to write security log:', error);
    }
  }

  // Specific logging methods
  async logLogin(userId: string, ip: string, userAgent: string, success: boolean): Promise<void> {
    await this.logSecurityEvent({
      eventType: success ? 'login' : 'failed_login',
      userId,
      ip,
      userAgent,
      details: { success },
      severity: success ? 'low' : 'medium'
    });
  }

  async logLogout(userId: string, ip: string, userAgent: string): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'logout',
      userId,
      ip,
      userAgent,
      details: {},
      severity: 'low'
    });
  }

  async logTokenRevoked(userId: string, ip: string, userAgent: string, tokenType: 'access' | 'refresh'): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'token_revoked',
      userId,
      ip,
      userAgent,
      details: { tokenType },
      severity: 'medium'
    });
  }

  async logRateLimitExceeded(ip: string, userAgent: string, endpoint: string): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'rate_limit_exceeded',
      ip,
      userAgent,
      details: { endpoint },
      severity: 'high'
    });
  }

  async logSuspiciousActivity(ip: string, userAgent: string, details: Record<string, any>): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'suspicious_activity',
      ip,
      userAgent,
      details,
      severity: 'high'
    });
  }

  async logPasswordReset(userId: string, ip: string, userAgent: string, success: boolean): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'password_reset',
      userId,
      ip,
      userAgent,
      details: { success },
      severity: 'medium'
    });
  }

  async logAccountCreated(userId: string, ip: string, userAgent: string): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'account_created',
      userId,
      ip,
      userAgent,
      details: {},
      severity: 'low'
    });
  }

  // Get recent security events (for monitoring)
  async getRecentEvents(limit: number = 100): Promise<SecurityEvent[]> {
    try {
      const logContent = await fs.promises.readFile(this.logFile, 'utf-8');
      const lines = logContent.trim().split('\n').slice(-limit);
      
      return lines.map(line => {
        // Parse log line back to SecurityEvent (simplified)
        const match = line.match(/\[(.*?)\] \[(.*?)\] \[(.*?)\] (.*?) \| IP: (.*?) \| UA: (.*?) \| Details: (.*)/);
        if (match) {
          return {
            timestamp: match[1],
            severity: match[2].toLowerCase() as SecurityEvent['severity'],
            eventType: match[3] as SecurityEvent['eventType'],
            userId: match[4] !== 'Anonymous' ? match[4].replace('User: ', '') : undefined,
            ip: match[5],
            userAgent: match[6],
            details: JSON.parse(match[7])
          };
        }
        return null;
      }).filter(Boolean) as SecurityEvent[];
    } catch (error) {
      console.error('Failed to read security log:', error);
      return [];
    }
  }

  // Clean up old logs (keep last 30 days)
  async cleanupOldLogs(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const logContent = await fs.promises.readFile(this.logFile, 'utf-8');
      const lines = logContent.trim().split('\n');
      
      const recentLines = lines.filter(line => {
        const timestampMatch = line.match(/\[(.*?)\]/);
        if (timestampMatch) {
          const logDate = new Date(timestampMatch[1]);
          return logDate > thirtyDaysAgo;
        }
        return true; // Keep lines that can't be parsed
      });
      
      await fs.promises.writeFile(this.logFile, recentLines.join('\n') + '\n');
      console.log('🧹 Cleaned up old security logs');
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }
}

// Create singleton instance
const securityLogger = new SecurityLogger();

// Clean up old logs daily
setInterval(() => {
  securityLogger.cleanupOldLogs();
}, 24 * 60 * 60 * 1000); // 24 hours

export default securityLogger; 
# MongoDB Security Configuration Guide

## 🔐 MongoDB Atlas Security (Recommended for Production)

### 1. Network Access Control (IP Whitelisting)

1. **Go to MongoDB Atlas Dashboard**
2. **Navigate to Network Access**
3. **Add IP Address:**
   - For development: Add your local IP
   - For production: Add your server's IP only
   - **Never use 0.0.0.0/0 (allow all IPs)**

### 2. Database User Configuration

1. **Go to Database Access**
2. **Create a new database user:**
   ```
   Username: finance-tracker-app
   Password: [generate strong password]
   Database User Privileges: Read and write to any database
   ```

### 3. Connection String Security

**Use this format for your MONGO_URI:**
```
mongodb+srv://finance-tracker-app:<password>@cluster.mongodb.net/finance-tracker?retryWrites=true&w=majority&authSource=admin
```

### 4. Environment Variables

Add to your `.env` file:
```env
MONGO_URI=mongodb+srv://finance-tracker-app:your-password@cluster.mongodb.net/finance-tracker?retryWrites=true&w=majority&authSource=admin
```

## 🛡️ Local MongoDB Security

### 1. Enable Authentication

1. **Create admin user:**
   ```bash
   mongosh
   use admin
   db.createUser({
     user: "admin",
     pwd: "your-admin-password",
     roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
   })
   ```

2. **Create application user:**
   ```bash
   use finance-tracker
   db.createUser({
     user: "finance-app",
     pwd: "your-app-password",
     roles: ["readWrite"]
   })
   ```

### 2. Enable Authentication in MongoDB

Edit `/etc/mongod.conf`:
```yaml
security:
  authorization: enabled
```

### 3. Restart MongoDB
```bash
sudo systemctl restart mongod
```

## 🔒 Additional Security Measures

### 1. Database Encryption

**MongoDB Atlas (Automatic):**
- Encryption at rest is enabled by default
- TLS/SSL encryption in transit

**Local MongoDB:**
```yaml
# /etc/mongod.conf
security:
  authorization: enabled
  keyFile: /path/to/keyfile

net:
  ssl:
    mode: requireSSL
    PEMKeyFile: /path/to/mongodb.pem
    CAFile: /path/to/ca.pem
```

### 2. Regular Backups

**MongoDB Atlas:**
- Automatic daily backups
- Point-in-time recovery

**Local MongoDB:**
```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --db finance-tracker --out /backups/$DATE
```

### 3. Monitoring and Alerts

**MongoDB Atlas:**
- Built-in monitoring
- Performance advisor
- Real-time alerts

**Local MongoDB:**
```bash
# Install MongoDB monitoring tools
npm install -g mongodb-memory-server
```

## 🚨 Security Checklist

### Network Security
- [ ] IP whitelisting configured
- [ ] No public access (0.0.0.0/0)
- [ ] VPN access for production

### Authentication
- [ ] Strong passwords for all users
- [ ] Application-specific database user
- [ ] Least privilege principle applied

### Encryption
- [ ] TLS/SSL enabled
- [ ] Encryption at rest
- [ ] Secure connection strings

### Monitoring
- [ ] Database access logs enabled
- [ ] Failed login monitoring
- [ ] Performance monitoring

### Backups
- [ ] Regular automated backups
- [ ] Backup encryption
- [ ] Test restore procedures

## 🔍 Security Testing

### 1. Connection Testing
```bash
# Test secure connection
mongosh "mongodb+srv://cluster.mongodb.net/finance-tracker" --username finance-tracker-app
```

### 2. Authentication Testing
```bash
# Test with wrong credentials
mongosh "mongodb+srv://cluster.mongodb.net/finance-tracker" --username wrong-user
```

### 3. Network Access Testing
```bash
# Test from unauthorized IP
curl -I mongodb://your-cluster-url
```

## 📞 Security Contact

For security issues with MongoDB:
- MongoDB Atlas: Support through Atlas dashboard
- Local MongoDB: Check MongoDB security documentation
- Report vulnerabilities: security@mongodb.com 
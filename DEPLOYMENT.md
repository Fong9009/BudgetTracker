# 🚀 Deployment Guide - Finance Tracker

## 🎯 **Quick Start: Railway (Recommended)**

### **Step 1: Prepare Your Repository**
```bash
# Ensure your code is committed to Git
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### **Step 2: Deploy to Railway**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize Railway project
railway init

# Deploy your app
railway up
```

### **Step 3: Configure Environment Variables**
In Railway dashboard:
1. Go to your project
2. Click "Variables" tab
3. Add all variables from `env.production.template`

### **Step 4: Set Up Database**
**MongoDB Atlas:**
- Create free cluster at [MongoDB Atlas](https://cloud.mongodb.com)
- Get connection string
- Add to `MONGO_URI` variable

## 🌐 **Alternative: Render**

### **Step 1: Create render.yaml**
```yaml
services:
  - type: web
    name: finance-tracker
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5001
```

### **Step 2: Deploy**
1. Connect your GitHub repo to Render
2. Create new Web Service
3. Configure environment variables
4. Deploy

## 🏠 **Local Production Setup**

### **Step 1: Build the Application**
```bash
# Install dependencies
npm install

# Build for production
npm run build
```

### **Step 2: Set Up Environment**
```bash
# Copy production template
cp env.production.template .env.production

# Edit with your values
nano .env.production
```

### **Step 3: Run in Production Mode**
```bash
# Start production server
npm start
```

## 🔒 **Security Checklist**

### **Before Deployment:**
- [ ] Generate strong JWT secrets (32+ characters)
- [ ] Generate strong encryption key (32 characters)
- [ ] Set up MongoDB with authentication
- [ ] Set up HTTPS certificates
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Set up security headers

### **Environment Variables Required:**
```bash
# Required for production
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-here
ENCRYPTION_KEY=your-32-character-encryption-key
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
NODE_ENV=production
```

## 📊 **Database Setup**

### **MongoDB Atlas (Recommended)**
1. **Create Account:** [MongoDB Atlas](https://cloud.mongodb.com)
2. **Create Cluster:** Free tier (M0)
3. **Set Up Database User:**
   - Username: `finance-tracker-app`
   - Password: Generate strong password
   - Role: `Read and write to any database`
4. **Network Access:**
   - Add your IP or `0.0.0.0/0` (for cloud deployment)
5. **Get Connection String:**
   ```
   mongodb+srv://finance-tracker-app:<password>@cluster.mongodb.net/finance-tracker?retryWrites=true&w=majority
   ```

## 🔧 **Custom Domain Setup**

### **Railway:**
1. Go to project settings
2. Click "Domains"
3. Add custom domain
4. Update DNS records

### **Render:**
1. Go to service settings
2. Click "Custom Domains"
3. Add domain
4. Update DNS records

## 📈 **Monitoring & Maintenance**

### **Health Checks:**
```bash
# Check application health
curl https://your-domain.com/api/health

# Expected response:
{
  "status": "healthy",
  "services": {
    "database": "connected"
  }
}
```

### **Logs:**
- **Railway:** `railway logs`
- **Render:** Dashboard → Logs
- **Local:** `npm start` (console output)

### **Backup Strategy:**
- **MongoDB Atlas:** Automatic daily backups
- **Application:** Git repository

## 🚨 **Troubleshooting**

### **Common Issues:**

#### **1. Environment Variables Not Loading**
```bash
# Check if variables are set
echo $JWT_SECRET

# Verify in application
curl https://your-domain.com/api/test-encryption
```

#### **2. Database Connection Failed**
```bash
# Check MongoDB connection
curl https://your-domain.com/api/test-mongodb

# Verify connection string format
mongodb+srv://username:password@cluster.mongodb.net/database
```

#### **3. Build Failures**
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 💰 **Cost Estimation**

### **Free Tier Options:**
- **Railway:** Free tier (500 hours/month)
- **Render:** Free tier available
- **MongoDB Atlas:** Free tier (512MB)

### **Paid Options:**
- **Railway:** $5-20/month
- **DigitalOcean:** $5-12/month
- **AWS EC2:** $3-15/month

## 🎉 **Success!**

Once deployed, your Finance Tracker will be:
- ✅ **Secure:** HTTPS, JWT tokens, encryption
- ✅ **Scalable:** Cloud hosting, database optimization
- ✅ **Monitored:** Health checks, logging
- ✅ **Maintained:** Automatic backups, updates

**Your personal finance tracker is now ready for production use!** 🚀 
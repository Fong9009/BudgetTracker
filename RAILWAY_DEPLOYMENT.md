# 🚀 Railway Deployment Guide

## Why Railway over Render?

### ✅ **Advantages:**
- **No Cold Starts**: App stays running 24/7
- **Better PWA Support**: Superior static file handling
- **Real-time Logs**: Live debugging capabilities
- **Faster Deployments**: 30-60 seconds vs 2-5 minutes
- **Custom Domains**: Free SSL certificates
- **Better Performance**: Dedicated resources

### ❌ **Current Render Issues:**
- MIME type errors for CSS/JS files
- Static asset serving problems
- Cold starts affecting PWA performance
- Limited debugging capabilities

## 🚀 Quick Deployment

### 1. **Install Railway CLI**
```bash
npm install -g @railway/cli
```

### 2. **Login to Railway**
```bash
railway login
```

### 3. **Initialize Project**
```bash
railway init
```

### 4. **Set Environment Variables**
```bash
railway variables set NODE_ENV=production
railway variables set MONGODB_URI=your_mongodb_uri
railway variables set JWT_SECRET=your_jwt_secret
railway variables set JWT_REFRESH_SECRET=your_refresh_secret
railway variables set FRONTEND_URL=https://your-app.railway.app
```

### 5. **Deploy**
```bash
railway up
```

## 🔧 Configuration Files

### **railway.json**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node dist/server/index.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### **package.json Scripts**
```json
{
  "scripts": {
    "railway:deploy": "railway up",
    "railway:logs": "railway logs",
    "railway:status": "railway status"
  }
}
```

## 🌐 Domain Setup

### **Custom Domain**
1. Go to Railway Dashboard
2. Select your project
3. Go to Settings → Domains
4. Add your custom domain
5. Update DNS records

### **Environment Variables**
```bash
railway variables set FRONTEND_URL=https://your-custom-domain.com
```

## 📊 Monitoring

### **View Logs**
```bash
railway logs
```

### **Check Status**
```bash
railway status
```

### **Metrics Dashboard**
- Visit Railway Dashboard
- Real-time metrics
- Performance monitoring
- Error tracking

## 🔄 CI/CD Setup

### **GitHub Actions**
```yaml
name: Deploy to Railway
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: railway/action@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
```

## 🛠️ Troubleshooting

### **Common Issues:**

#### **1. Build Failures**
```bash
# Check build logs
railway logs --build

# Fix common issues:
# - Ensure all dependencies are in package.json
# - Check Node.js version compatibility
# - Verify build script works locally
```

#### **2. Runtime Errors**
```bash
# View real-time logs
railway logs --follow

# Check environment variables
railway variables
```

#### **3. PWA Issues**
```bash
# Verify static file serving
curl -I https://your-app.railway.app/assets/index.css

# Check service worker
curl -I https://your-app.railway.app/sw.js
```

## 💰 Cost Comparison

### **Render:**
- Free: 750 hours/month (sleeps after 15min)
- Paid: $7/month (always on)

### **Railway:**
- Free: $5 credit/month (~500 hours)
- Paid: Pay-as-you-use ($0.000463/second)

### **Recommendation:**
- **Development**: Use Railway free tier
- **Production**: Railway paid for better performance

## 🎯 Migration Checklist

### **Before Migration:**
- [ ] Backup current data
- [ ] Test build locally
- [ ] Update environment variables
- [ ] Verify PWA functionality

### **After Migration:**
- [ ] Test all features
- [ ] Verify PWA installation
- [ ] Check offline functionality
- [ ] Monitor performance
- [ ] Update DNS if using custom domain

## 🚀 Performance Benefits

### **Railway Advantages:**
- **Instant Deployments**: 30-60 seconds
- **No Cold Starts**: Always responsive
- **Better Caching**: Superior static file handling
- **Real-time Monitoring**: Live debugging
- **Global CDN**: Faster asset delivery

### **PWA Improvements:**
- **Faster Loading**: No cold starts
- **Better Caching**: Improved service worker
- **Reliable Sync**: Background sync works better
- **Offline Support**: Enhanced offline functionality

## 📞 Support

### **Railway Support:**
- Documentation: https://docs.railway.app
- Discord: https://discord.gg/railway
- Email: support@railway.app

### **Migration Help:**
- Test deployment on Railway first
- Keep Render deployment as backup
- Gradually migrate users
- Monitor performance metrics 
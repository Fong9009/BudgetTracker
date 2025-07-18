import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express, { type Express } from 'express';
import { registerRoutes } from '../routes';
import { storage } from '../storage';
import { hashPassword } from '../auth';

describe('API Integration Tests', () => {
  let app: Express;
  let mongoServer: MongoMemoryServer;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Set JWT secret for testing
    process.env.JWT_SECRET = 'test-secret-key';
    
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to test database
    await mongoose.connect(mongoUri);
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Register routes
    await registerRoutes(app);
    
    // Create test user through registration
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpassword123',
        confirmPassword: 'testpassword123'
      });
    
    console.log('Register response:', registerResponse.status, registerResponse.body);
    testUserId = registerResponse.body.user.id;
    authToken = registerResponse.body.token;
    console.log('Auth token:', authToken);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await storage.clearTestData();
  });

  describe('Authentication Endpoints', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', 'newuser');
      expect(response.body.user).toHaveProperty('email', 'newuser@example.com');
    });

    it('should login existing user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', 'testuser');
    });

    it('should reject invalid login credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid email or password');
    });
  });

  describe('Account Endpoints', () => {
    it('should create a new account', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Account',
          type: 'checking',
          balance: '1000.00'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', 'Test Account');
      expect(response.body).toHaveProperty('type', 'checking');
      expect(response.body).toHaveProperty('balance', 1000);
    });

    it('should get user accounts', async () => {
      // Create an account first
      await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Account',
          type: 'checking',
          balance: '1000.00'
        });

      const response = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should update an account', async () => {
      // Create an account first
      const createResponse = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Account',
          type: 'checking',
          balance: '1000.00'
        });

      const accountId = createResponse.body._id;

      const response = await request(app)
        .put(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Account',
          balance: '1500.00'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Updated Account');
      expect(response.body).toHaveProperty('balance', 1500);
    });
  });

  describe('Category Endpoints', () => {
    it('should create a new category', async () => {
      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Category',
          color: '#3b82f6',
          icon: 'fas fa-tag'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', 'Test Category');
      expect(response.body).toHaveProperty('color', '#3b82f6');
      expect(response.body).toHaveProperty('icon', 'fas fa-tag');
    });

    it('should get user categories', async () => {
      // Create a category first
      await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Category',
          color: '#3b82f6',
          icon: 'fas fa-tag'
        });

      const response = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Endpoints', () => {
    let accountId: string;
    let categoryId: string;

    beforeEach(async () => {
      // Create test account and category
      const accountResponse = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Account',
          type: 'checking',
          balance: '1000.00'
        });
      accountId = accountResponse.body._id;

      const categoryResponse = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Category',
          color: '#3b82f6',
          icon: 'fas fa-tag'
        });
      categoryId = categoryResponse.body._id;
    });

    it('should create a new transaction', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '100.00',
          description: 'Test Transaction',
          type: 'expense',
          date: new Date().toISOString(),
          accountId,
          categoryId
        });

      console.log('Create transaction response:', response.status, response.body);
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('amount', 100);
      expect(response.body).toHaveProperty('description', 'Test Transaction');
      expect(response.body).toHaveProperty('type', 'expense');
    });

    it('should get transactions with filters', async () => {
      // Create a transaction first
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '100.00',
          description: 'Test Transaction',
          type: 'expense',
          date: new Date().toISOString(),
          accountId,
          categoryId
        });

      const response = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('transactions');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Invalid: empty name
          type: 'checking',
          balance: '1000.00'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation failed');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email', // Invalid email format
          password: 'password123',
          confirmPassword: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation failed');
    });
  });
}); 
import { describe, it, expect } from 'vitest';
import {
  registerUserSchema,
  loginUserSchema,
  insertAccountSchema,
  insertCategorySchema,
  insertTransactionSchema,
  transferSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  transactionFiltersSchema,
  paginationSchema
} from '../schema';

describe('Zod Schema Validation', () => {
  describe('registerUserSchema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      };

      const result = registerUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'differentpassword'
      };

      const result = registerUserSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('confirmPassword');
      }
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123',
        confirmPassword: 'password123'
      };

      const result = registerUserSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short username', () => {
      const invalidData = {
        username: 'ab',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      };

      const result = registerUserSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('loginUserSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = loginUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: ''
      };

      const result = loginUserSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('insertAccountSchema', () => {
    it('should validate valid account data', () => {
      const validData = {
        name: 'Test Account',
        type: 'checking',
        balance: '1000.00'
      };

      const result = insertAccountSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid balance format', () => {
      const invalidData = {
        name: 'Test Account',
        type: 'checking',
        balance: '1000.123' // Too many decimal places
      };

      const result = insertAccountSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        type: 'checking',
        balance: '1000.00'
      };

      const result = insertAccountSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('insertCategorySchema', () => {
    it('should validate valid category data', () => {
      const validData = {
        name: 'Test Category',
        color: '#3b82f6',
        icon: 'fas fa-tag'
      };

      const result = insertCategorySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        color: '#3b82f6',
        icon: 'fas fa-tag'
      };

      const result = insertCategorySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('insertTransactionSchema', () => {
    it('should validate valid transaction data', () => {
      const validData = {
        amount: '100.00',
        description: 'Test Transaction',
        type: 'expense',
        date: '2024-01-15T10:00:00.000Z',
        accountId: 'account123',
        categoryId: 'category123'
      };

      const result = insertTransactionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const invalidData = {
        amount: '100.00',
        description: 'Test Transaction',
        type: 'expense',
        date: 'invalid-date',
        accountId: 'account123',
        categoryId: 'category123'
      };

      const result = insertTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('transferSchema', () => {
    it('should validate valid transfer data', () => {
      const validData = {
        amount: '100.00',
        description: 'Monthly savings',
        date: '2024-01-15T10:00:00.000Z',
        fromAccountId: 'account1',
        toAccountId: 'account2'
      };

      const result = transferSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject same source and destination accounts', () => {
      const invalidData = {
        amount: '100.00',
        description: 'Monthly savings',
        date: '2024-01-15T10:00:00.000Z',
        fromAccountId: 'account1',
        toAccountId: 'account1'
      };

      const result = transferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('updateProfileSchema', () => {
    it('should validate valid profile update data', () => {
      const validData = {
        username: 'newusername',
        email: 'newemail@example.com'
      };

      const result = updateProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
      const validData = {
        username: 'newusername'
        // email is optional
      };

      const result = updateProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        username: 'newusername',
        email: 'invalid-email'
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate valid password change data', () => {
      const validData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };

      const result = changePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject short new password', () => {
      const invalidData = {
        currentPassword: 'oldpassword',
        newPassword: '123'
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty current password', () => {
      const invalidData = {
        currentPassword: '',
        newPassword: 'newpassword123'
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate valid email', () => {
      const validData = {
        email: 'test@example.com'
      };

      const result = forgotPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email'
      };

      const result = forgotPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should validate valid reset data', () => {
      const validData = {
        token: 'reset-token-123',
        password: 'newpassword123'
      };

      const result = resetPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty token', () => {
      const invalidData = {
        token: '',
        password: 'newpassword123'
      };

      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('transactionFiltersSchema', () => {
    it('should validate valid filter data', () => {
      const validData = {
        search: 'test',
        accountId: 'account123',
        categoryId: 'category123',
        type: 'expense',
        transactionKind: 'transaction',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        amountMin: '100',
        amountMax: '1000',
        sortBy: 'date',
        sortOrder: 'desc',
        page: '1',
        limit: '50'
      };

      const result = transactionFiltersSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow partial filters', () => {
      const validData = {
        search: 'test'
        // All other fields are optional
      };

      const result = transactionFiltersSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid sort order', () => {
      const invalidData = {
        sortOrder: 'invalid'
      };

      const result = transactionFiltersSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should validate valid pagination data', () => {
      const validData = {
        page: 1,
        limit: 50
      };

      const result = paginationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const validData = {};

      const result = paginationSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject negative page', () => {
      const invalidData = {
        page: -1,
        limit: 50
      };

      const result = paginationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject limit too high', () => {
      const invalidData = {
        page: 1,
        limit: 200
      };

      const result = paginationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
}); 
import { describe, it, expect } from 'vitest';
import { 
  formatCurrency, 
  formatDate, 
  formatDateFull, 
  getAccountTypeIcon, 
  getAccountTypeColor,
  getTransactionTypeColor,
  groupTransferTransactions,
  isTransferTransaction,
  extractTransferInfo
} from '../utils';
import type { TransactionWithDetails } from '@shared/schema';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format positive numbers correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency('1234.56')).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format negative numbers correctly', () => {
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
      expect(formatCurrency('-1234.56')).toBe('-$1,234.56');
    });

    it('should handle decimal places correctly', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(100.1)).toBe('$100.10');
      expect(formatCurrency(100.123)).toBe('$100.12');
    });
  });

  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toBe('Jan 15, 2024');
      expect(formatDate('2024-01-15')).toBe('Jan 15, 2024');
    });
  });

  describe('formatDateFull', () => {
    it('should format full dates correctly', () => {
      const date = new Date('2024-01-15');
      expect(formatDateFull(date)).toBe('Mon, Jan 15, 2024');
      expect(formatDateFull('2024-01-15')).toBe('Mon, Jan 15, 2024');
    });
  });

  describe('getAccountTypeIcon', () => {
    it('should return correct icons for account types', () => {
      expect(getAccountTypeIcon('checking')).toBe('fas fa-university');
      expect(getAccountTypeIcon('savings')).toBe('fas fa-piggy-bank');
      expect(getAccountTypeIcon('credit')).toBe('fas fa-credit-card');
      expect(getAccountTypeIcon('investment')).toBe('fas fa-chart-line');
      expect(getAccountTypeIcon('unknown')).toBe('fas fa-wallet');
    });
  });

  describe('getAccountTypeColor', () => {
    it('should return correct colors for account types', () => {
      expect(getAccountTypeColor('checking')).toBe('bg-blue-500');
      expect(getAccountTypeColor('savings')).toBe('bg-green-500');
      expect(getAccountTypeColor('credit')).toBe('bg-red-500');
      expect(getAccountTypeColor('investment')).toBe('bg-purple-500');
      expect(getAccountTypeColor('unknown')).toBe('bg-gray-500');
    });
  });

  describe('getTransactionTypeColor', () => {
    it('should return correct colors for transaction types', () => {
      expect(getTransactionTypeColor('income')).toBe('text-green-600');
      expect(getTransactionTypeColor('expense')).toBe('text-red-600');
      expect(getTransactionTypeColor('transfer')).toBe('text-foreground');
      expect(getTransactionTypeColor('unknown')).toBe('text-foreground');
    });
  });

  describe('isTransferTransaction', () => {
    it('should identify transfer transactions correctly', () => {
      const transferTransaction: TransactionWithDetails = {
        _id: '1',
        amount: 100,
        description: 'Transfer to Savings: Monthly savings',
        type: 'expense',
        date: new Date(),
        accountId: 'account1',
        categoryId: 'category1',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        account: { _id: 'account1', name: 'Checking', type: 'checking', balance: 1000, userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() },
        category: { _id: 'category1', name: 'Transfer', color: '#000', icon: 'fas fa-exchange-alt', userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() }
      };

      const regularTransaction: TransactionWithDetails = {
        _id: '2',
        amount: 50,
        description: 'Grocery shopping',
        type: 'expense',
        date: new Date(),
        accountId: 'account1',
        categoryId: 'category2',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        account: { _id: 'account1', name: 'Checking', type: 'checking', balance: 1000, userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() },
        category: { _id: 'category2', name: 'Groceries', color: '#000', icon: 'fas fa-shopping-cart', userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() }
      };

      expect(isTransferTransaction(transferTransaction)).toBe(true);
      expect(isTransferTransaction(regularTransaction)).toBe(false);
    });
  });

  describe('extractTransferInfo', () => {
    it('should extract transfer information correctly', () => {
      expect(extractTransferInfo('Transfer to Savings: Monthly savings')).toEqual({
        direction: 'to',
        accountName: 'Savings',
        userDescription: 'Monthly savings'
      });

      expect(extractTransferInfo('Transfer from Checking: Emergency fund')).toEqual({
        direction: 'from',
        accountName: 'Checking',
        userDescription: 'Emergency fund'
      });

      expect(extractTransferInfo('Regular transaction')).toBeNull();
    });
  });

  describe('groupTransferTransactions', () => {
    it('should handle empty or null input', () => {
      expect(groupTransferTransactions([])).toEqual([]);
      expect(groupTransferTransactions(null as any)).toEqual([]);
      expect(groupTransferTransactions(undefined as any)).toEqual([]);
    });

    it('should group transfer pairs correctly', () => {
      const fromTransaction: TransactionWithDetails = {
        _id: 'from1',
        amount: 100,
        description: 'Transfer to Savings: Monthly savings',
        type: 'expense',
        date: new Date('2024-01-15'),
        accountId: 'checking',
        categoryId: 'transfer',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        account: { _id: 'checking', name: 'Checking', type: 'checking', balance: 900, userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() },
        category: { _id: 'transfer', name: 'Transfer', color: '#000', icon: 'fas fa-exchange-alt', userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() }
      };

      const toTransaction: TransactionWithDetails = {
        _id: 'to1',
        amount: 100,
        description: 'Transfer from Checking: Monthly savings',
        type: 'income',
        date: new Date('2024-01-15'),
        accountId: 'savings',
        categoryId: 'transfer',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        account: { _id: 'savings', name: 'Savings', type: 'savings', balance: 1100, userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() },
        category: { _id: 'transfer', name: 'Transfer', color: '#000', icon: 'fas fa-exchange-alt', userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() }
      };

      const result = groupTransferTransactions([fromTransaction, toTransaction]);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('transfer');
      expect(result[0].description).toBe('Monthly savings');
      expect(result[0].amount).toBe(100);
    });

    it('should handle regular transactions without grouping', () => {
      const regularTransaction: TransactionWithDetails = {
        _id: 'regular1',
        amount: 50,
        description: 'Grocery shopping',
        type: 'expense',
        date: new Date(),
        accountId: 'account1',
        categoryId: 'category1',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        account: { _id: 'account1', name: 'Checking', type: 'checking', balance: 950, userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() },
        category: { _id: 'category1', name: 'Groceries', color: '#000', icon: 'fas fa-shopping-cart', userId: 'user1', isArchived: false, createdAt: new Date(), updatedAt: new Date() }
      };

      const result = groupTransferTransactions([regularTransaction]);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('expense');
      expect(result[0].description).toBe('Grocery shopping');
    });
  });
}); 
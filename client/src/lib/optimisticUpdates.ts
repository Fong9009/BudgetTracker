import { queryClient } from './queryClient';
import type { Account, Category, Transaction } from '@shared/schema';

// Optimistic update utilities for instant UI feedback
export const optimisticUpdates = {
  // Add transaction optimistically
  addTransaction: (newTransaction: Omit<Transaction, '_id' | 'createdAt' | 'updatedAt'>) => {
    const optimisticTransaction: Transaction = {
      ...newTransaction,
      _id: `temp_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Update transactions list
    queryClient.setQueryData(['/api/transactions'], (old: Transaction[] = []) => {
      return [optimisticTransaction, ...old];
    });

    // Update analytics
    queryClient.setQueryData(['/api/analytics'], (old: any) => {
      if (!old) return old;
      
      const amount = newTransaction.amount;
      const isIncome = newTransaction.type === 'income';
      
      return {
        ...old,
        monthlyIncome: old.monthlyIncome + (isIncome ? amount : 0),
        monthlyExpenses: old.monthlyExpenses + (isIncome ? 0 : amount),
        totalBalance: old.totalBalance + (isIncome ? amount : -amount),
      };
    });

    // Update account balance
    queryClient.setQueryData(['/api/accounts'], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map(account => {
        if (account._id === newTransaction.accountId) {
          const amount = newTransaction.amount;
          const balanceChange = newTransaction.type === 'income' ? amount : -amount;
          return {
            ...account,
            balance: account.balance + balanceChange,
          };
        }
        return account;
      });
    });

    return optimisticTransaction;
  },

  // Add account optimistically
  addAccount: (newAccount: Omit<Account, '_id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    const optimisticAccount: Account = {
      ...newAccount,
      _id: `temp_${Date.now()}`,
      userId: 'temp-user', // Will be replaced with real data
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queryClient.setQueryData(['/api/accounts'], (old: any) => {
      if (!Array.isArray(old)) return [optimisticAccount];
      return [...old, optimisticAccount];
    });

    // Update analytics
    queryClient.setQueryData(['/api/analytics'], (old: any) => {
      if (!old) return old;
      
      return {
        ...old,
        totalBalance: old.totalBalance + newAccount.balance,
      };
    });

    return optimisticAccount;
  },

  // Add category optimistically
  addCategory: (newCategory: Omit<Category, '_id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    const optimisticCategory: Category = {
      ...newCategory,
      _id: `temp_${Date.now()}`,
      userId: 'temp-user', // Will be replaced with real data
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    queryClient.setQueryData(['/api/categories'], (old: any) => {
      if (!Array.isArray(old)) return [optimisticCategory];
      return [...old, optimisticCategory];
    });

    // Also update categories with counts query
    queryClient.setQueryData(['/api/categories/with-counts'], (old: any) => {
      if (!Array.isArray(old)) return [{ ...optimisticCategory, transactionCount: 0 }];
      return [...old, { ...optimisticCategory, transactionCount: 0 }];
    });

    return optimisticCategory;
  },

  // Remove optimistic updates on error
  removeOptimistic: (type: 'transaction' | 'account' | 'category', tempId: string) => {
    const queryKey = type === 'transaction' ? ['/api/transactions'] : 
                    type === 'account' ? ['/api/accounts'] : 
                    ['/api/categories'];

    queryClient.setQueryData(queryKey, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.filter(item => item._id !== tempId);
    });

    // Also remove from categories with counts if it's a category
    if (type === 'category') {
      queryClient.setQueryData(['/api/categories/with-counts'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter(item => item._id !== tempId);
      });
    }

    // Invalidate queries to refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
    queryClient.invalidateQueries({ queryKey: ['/api/categories/with-counts'] });
  },
}; 
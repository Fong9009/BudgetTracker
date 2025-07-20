import { openDB, IDBPDatabase } from 'idb';

// Database schema
interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  account: string;
  type: 'income' | 'expense';
  date: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  localId?: string;
}

interface Account {
  id: string;
  name: string;
  balance: number;
  type: string;
  color: string;
  synced: boolean;
  localId?: string;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  synced: boolean;
  localId?: string;
}

interface SyncQueue {
  id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  table: 'transactions' | 'accounts' | 'categories';
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineDB {
  private db: IDBPDatabase | null = null;
  private readonly DB_NAME = 'FinanceTrackerOffline';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    try {
      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade: (db) => {
          // Transactions store
          if (!db.objectStoreNames.contains('transactions')) {
            const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
            transactionStore.createIndex('synced', 'synced', { unique: false });
            transactionStore.createIndex('date', 'date', { unique: false });
            transactionStore.createIndex('category', 'category', { unique: false });
          }

          // Accounts store
          if (!db.objectStoreNames.contains('accounts')) {
            const accountStore = db.createObjectStore('accounts', { keyPath: 'id' });
            accountStore.createIndex('synced', 'synced', { unique: false });
          }

          // Categories store
          if (!db.objectStoreNames.contains('categories')) {
            const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
            categoryStore.createIndex('synced', 'synced', { unique: false });
            categoryStore.createIndex('type', 'type', { unique: false });
          }

          // Sync queue store
          if (!db.objectStoreNames.contains('syncQueue')) {
            const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
            syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          }

          // User data store
          if (!db.objectStoreNames.contains('userData')) {
            db.createObjectStore('userData', { keyPath: 'key' });
          }
        },
      });
      console.log('OfflineDB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OfflineDB:', error);
      throw error;
    }
  }

  // Transaction operations
  async addTransaction(transaction: Omit<Transaction, 'id' | 'synced'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTransaction: Transaction = {
      ...transaction,
      id: localId,
      synced: false,
      localId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.db.add('transactions', newTransaction);
    await this.addToSyncQueue('CREATE', 'transactions', newTransaction);
    
    return localId;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = await this.db.get('transactions', id);
    if (!transaction) throw new Error('Transaction not found');

    const updatedTransaction: Transaction = {
      ...transaction,
      ...updates,
      synced: false,
      updatedAt: new Date().toISOString(),
    };

    await this.db.put('transactions', updatedTransaction);
    await this.addToSyncQueue('UPDATE', 'transactions', updatedTransaction);
  }

  async deleteTransaction(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = await this.db.get('transactions', id);
    if (!transaction) throw new Error('Transaction not found');

    await this.db.delete('transactions', id);
    await this.addToSyncQueue('DELETE', 'transactions', { id, ...transaction });
  }

  async getTransactions(filters?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    account?: string;
  }): Promise<Transaction[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    let transactions = await this.db.getAll('transactions');
    
    // Apply filters
    if (filters) {
      transactions = transactions.filter(t => {
        if (filters.startDate && t.date < filters.startDate) return false;
        if (filters.endDate && t.date > filters.endDate) return false;
        if (filters.category && t.category !== filters.category) return false;
        if (filters.account && t.account !== filters.account) return false;
        return true;
      });
    }

    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Account operations
  async addAccount(account: Omit<Account, 'id' | 'synced'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newAccount: Account = {
      ...account,
      id: localId,
      synced: false,
      localId,
    };

    await this.db.add('accounts', newAccount);
    await this.addToSyncQueue('CREATE', 'accounts', newAccount);
    
    return localId;
  }

  async getAccounts(): Promise<Account[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAll('accounts');
  }

  // Category operations
  async addCategory(category: Omit<Category, 'id' | 'synced'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCategory: Category = {
      ...category,
      id: localId,
      synced: false,
      localId,
    };

    await this.db.add('categories', newCategory);
    await this.addToSyncQueue('CREATE', 'categories', newCategory);
    
    return localId;
  }

  async getCategories(type?: 'income' | 'expense'): Promise<Category[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    if (type) {
      return await this.db.getAllFromIndex('categories', 'type', type);
    }
    return await this.db.getAll('categories');
  }

  // Sync operations
  async addToSyncQueue(
    operation: SyncQueue['operation'],
    table: SyncQueue['table'],
    data: any
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const syncItem: SyncQueue = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      table,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    await this.db.add('syncQueue', syncItem);
  }

  async getSyncQueue(): Promise<SyncQueue[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAll('syncQueue');
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.delete('syncQueue', id);
  }

  async markAsSynced(table: string, id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const store = this.db.transaction(table, 'readwrite').objectStore(table);
    const item = await store.get(id);
    if (item) {
      item.synced = true;
      await store.put(item);
    }
  }

  async getLocalData(table: string, localId: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.get(table, localId);
  }

  async updateLocalData(table: string, id: string, data: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put(table, data);
  }

  // Analytics
  async getAnalytics(): Promise<{
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    transactions: Transaction[];
  }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transactions = await this.getTransactions();
    const accounts = await this.getAccounts();
    
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const monthlyTransactions = transactions.filter(t => 
      t.date.startsWith(currentMonth)
    );

    const monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    return {
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      transactions: monthlyTransactions,
    };
  }

  // Data import/export
  async exportData(): Promise<{
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
  }> {
    if (!this.db) throw new Error('Database not initialized');
    
    return {
      transactions: await this.db.getAll('transactions'),
      accounts: await this.db.getAll('accounts'),
      categories: await this.db.getAll('categories'),
    };
  }

  async importData(data: {
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const tx = this.db.transaction(['transactions', 'accounts', 'categories'], 'readwrite');
    
    // Clear existing data
    await tx.objectStore('transactions').clear();
    await tx.objectStore('accounts').clear();
    await tx.objectStore('categories').clear();
    
    // Import new data
    for (const transaction of data.transactions) {
      await tx.objectStore('transactions').add(transaction);
    }
    for (const account of data.accounts) {
      await tx.objectStore('accounts').add(account);
    }
    for (const category of data.categories) {
      await tx.objectStore('categories').add(category);
    }
    
    await tx.done;
  }

  // User data storage
  async setUserData(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('userData', { key, value });
  }

  async getUserData(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.get('userData', key);
    return result?.value;
  }
}

// Singleton instance
export const offlineDB = new OfflineDB();

// Initialize on app start
export const initOfflineDB = async () => {
  await offlineDB.init();
  console.log('OfflineDB ready for offline operations');
}; 
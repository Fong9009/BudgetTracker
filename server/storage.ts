import { UserModel, AccountModel, CategoryModel, TransactionModel, type User, type Account, type Category, type Transaction, type TransactionWithDetails, type RegisterUser, type InsertAccount, type InsertCategory, type InsertTransaction, type Transfer } from "@shared/schema";
import { hashPassword } from "./auth";

export interface IStorage {
  // Users
  createUser(user: RegisterUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Accounts
  getAccounts(userId: string): Promise<Account[]>;
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount, userId: string): Promise<Account>;
  updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: string): Promise<boolean>;
  getArchivedAccounts(userId: string): Promise<Account[]>;
  restoreAccount(id: string): Promise<boolean>;
  permanentDeleteAccount(id: string): Promise<boolean>;

  // Categories
  getCategories(userId: string): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory, userId: string): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  getArchivedCategories(userId: string): Promise<Category[]>;
  restoreCategory(id: string): Promise<boolean>;
  permanentDeleteCategory(id: string): Promise<boolean>;

  // Transactions
  getTransactions(userId: string): Promise<TransactionWithDetails[]>;
  getTransaction(id: string): Promise<TransactionWithDetails | undefined>;
  getTransactionsByAccount(accountId: string): Promise<TransactionWithDetails[]>;
  getTransactionsByCategory(categoryId: string): Promise<TransactionWithDetails[]>;
  createTransaction(transaction: InsertTransaction): Promise<TransactionWithDetails>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<TransactionWithDetails | undefined>;
  deleteTransaction(id: string): Promise<boolean>;
  getArchivedTransactions(userId: string): Promise<TransactionWithDetails[]>;
  restoreTransaction(id: string): Promise<boolean>;
  permanentDeleteTransaction(id: string): Promise<boolean>;

  // Transfers
  createTransfer(transfer: Transfer, userId: string): Promise<{ fromTransaction: TransactionWithDetails; toTransaction: TransactionWithDetails }>;
}

export class MongoDBStorage implements IStorage {
  constructor() {
    // Don't initialize defaults since we now require users to be authenticated
  }

  // User methods
  async createUser(userData: RegisterUser): Promise<User> {
    const hashedPassword = await hashPassword(userData.password);
    const user = await UserModel.create({
      ...userData,
      password: hashedPassword
    });
    return this.transformUser(user);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ email });
    return user ? this.transformUser(user) : undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const user = await UserModel.findById(id);
    return user ? this.transformUser(user) : undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    return user ? this.transformUser(user) : undefined;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const updatePayload: any = { $set: {}, $unset: {} };

    for (const key in updates) {
      const value = (updates as any)[key];
      if (value !== undefined) {
        updatePayload.$set[key] = value;
      } else {
        updatePayload.$unset[key] = "";
      }
    }

    if (Object.keys(updatePayload.$set).length === 0) {
      delete updatePayload.$set;
    }
    if (Object.keys(updatePayload.$unset).length === 0) {
      delete updatePayload.$unset;
    }
    
    if (Object.keys(updatePayload).length === 0) {
      return this.getUserById(id);
    }

    if (!updatePayload.$set) {
      updatePayload.$set = {};
    }
    updatePayload.$set.updatedAt = new Date();

    const user = await UserModel.findByIdAndUpdate(
      id, 
      updatePayload,
      { new: true }
    );
    return user ? this.transformUser(user) : undefined;
  }

  // Account methods
  async getAccounts(userId: string): Promise<Account[]> {
    const accounts = await AccountModel.find({ userId, isArchived: { $ne: true } }).sort({ createdAt: -1 });
    return accounts.map(acc => this.transformAccount(acc));
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const account = await AccountModel.findById(id);
    return account ? this.transformAccount(account) : undefined;
  }

  async createAccount(insertAccount: InsertAccount, userId: string): Promise<Account> {
    const accountData = {
      ...insertAccount,
      balance: parseFloat(insertAccount.balance),
      userId
    };
    const account = await AccountModel.create(accountData);
    return this.transformAccount(account);
  }

  async updateAccount(id: string, updates: Partial<InsertAccount>): Promise<Account | undefined> {
    const updateData = { ...updates };
    if (updateData.balance) {
      (updateData as any).balance = parseFloat(updateData.balance);
    }
    
    const account = await AccountModel.findByIdAndUpdate(id, updateData, { new: true });
    return account ? this.transformAccount(account) : undefined;
  }

  async deleteAccount(id: string): Promise<boolean> {
    try {
      // Check if account is being used by any non-archived transactions
      const transactionCount = await TransactionModel.countDocuments({ accountId: id, isArchived: false });
      if (transactionCount > 0) {
        throw new Error(`Cannot archive account: ${transactionCount} active transactions are associated with this account. Please archive or delete those transactions first.`);
      }
      
      const result = await AccountModel.findByIdAndUpdate(id, { isArchived: true }, { new: true });
      return !!result;
    } catch (error) {
      console.error("Error archiving account:", error);
      throw error;
    }
  }

  async getArchivedAccounts(userId: string): Promise<Account[]> {
    const accounts = await AccountModel.find({ userId, isArchived: true });
    return accounts.map(acc => this.transformAccount(acc));
  }

  async restoreAccount(id: string): Promise<boolean> {
    const result = await AccountModel.findByIdAndUpdate(id, { isArchived: false }, { new: true });
    return !!result;
  }

  async permanentDeleteAccount(id: string): Promise<boolean> {
    try {
      // Check if account is being used by any transactions (both active and archived)
      const transactionCount = await TransactionModel.countDocuments({ accountId: id });
      if (transactionCount > 0) {
        throw new Error(`Cannot permanently delete account: ${transactionCount} transactions are associated with this account. Please permanently delete all associated transactions first.`);
      }
      
      const result = await AccountModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error("Error permanently deleting account:", error);
      throw error;
    }
  }

  // Category methods
  async getCategories(userId: string): Promise<Category[]> {
    const categories = await CategoryModel.find({ userId, isArchived: { $ne: true } }).sort({ createdAt: -1 });
    return categories.map(cat => this.transformCategory(cat));
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const category = await CategoryModel.findById(id);
    return category ? this.transformCategory(category) : undefined;
  }

  async createCategory(insertCategory: InsertCategory, userId: string): Promise<Category> {
    const categoryData = {
      ...insertCategory,
      userId
    };
    const category = await CategoryModel.create(categoryData);
    return this.transformCategory(category);
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const category = await CategoryModel.findByIdAndUpdate(id, updates, { new: true });
    return category ? this.transformCategory(category) : undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    try {
      // Check if category is being used by any non-archived transactions
      const transactionCount = await TransactionModel.countDocuments({ categoryId: id, isArchived: false });
      if (transactionCount > 0) {
        throw new Error(`Cannot archive category: ${transactionCount} active transactions are using this category. Please archive or delete those transactions first.`);
      }
      
      const result = await CategoryModel.findByIdAndUpdate(id, { isArchived: true }, { new: true });
      return !!result;
    } catch (error) {
      console.error("Error archiving category:", error);
      throw error;
    }
  }

  async getArchivedCategories(userId: string): Promise<Category[]> {
    const categories = await CategoryModel.find({ userId, isArchived: true });
    return categories.map(cat => this.transformCategory(cat));
  }

  async restoreCategory(id: string): Promise<boolean> {
    const result = await CategoryModel.findByIdAndUpdate(id, { isArchived: false }, { new: true });
    return !!result;
  }

  async permanentDeleteCategory(id: string): Promise<boolean> {
    try {
      // Check if category is being used by any transactions (both active and archived)
      const transactionCount = await TransactionModel.countDocuments({ categoryId: id });
      if (transactionCount > 0) {
        throw new Error(`Cannot permanently delete category: ${transactionCount} transactions are associated with this category. Please permanently delete all associated transactions first.`);
      }
      
      const result = await CategoryModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error("Error permanently deleting category:", error);
      throw error;
    }
  }

  // Transaction methods
  async getTransactions(userId: string): Promise<TransactionWithDetails[]> {
    const transactions = await TransactionModel.find({ isArchived: { $ne: true } })
      .populate({
        path: 'accountId',
        match: { userId }
      })
      .populate({
        path: 'categoryId',
        match: { userId }
      })
      .sort({ date: -1 });
    
    // Filter out transactions where account or category doesn't belong to user
    const userTransactions = transactions.filter(tx => tx.accountId && tx.categoryId);
    return userTransactions.map(tx => this.transformTransactionWithDetails(tx));
  }

  async getTransaction(id: string): Promise<TransactionWithDetails | undefined> {
    const transaction = await TransactionModel.findById(id)
      .populate('accountId')
      .populate('categoryId');
    
    return transaction ? this.transformTransactionWithDetails(transaction) : undefined;
  }

  async getTransactionsByAccount(accountId: string): Promise<TransactionWithDetails[]> {
    const transactions = await TransactionModel.find({ accountId })
      .populate('accountId')
      .populate('categoryId')
      .sort({ date: -1 });
    
    return transactions.map(tx => this.transformTransactionWithDetails(tx));
  }

  async getTransactionsByCategory(categoryId: string): Promise<TransactionWithDetails[]> {
    const transactions = await TransactionModel.find({ categoryId })
      .populate('accountId')
      .populate('categoryId')
      .sort({ date: -1 });
    
    return transactions.map(tx => this.transformTransactionWithDetails(tx));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<TransactionWithDetails> {
    const transactionData = {
      ...insertTransaction,
      amount: parseFloat(insertTransaction.amount),
      date: new Date(insertTransaction.date)
    };
    
    const transaction = await TransactionModel.create(transactionData);
    
    // Populate the created transaction
    const populatedTransaction = await TransactionModel.findById(transaction._id)
      .populate('accountId')
      .populate('categoryId');
    
    if (!populatedTransaction) {
      throw new Error("Failed to create transaction");
    }
    
    return this.transformTransactionWithDetails(populatedTransaction);
  }

  async updateTransaction(id: string, updates: Partial<InsertTransaction>): Promise<TransactionWithDetails | undefined> {
    const updateData = { ...updates };
    if (updateData.amount) {
      (updateData as any).amount = parseFloat(updateData.amount);
    }
    if (updateData.date) {
      (updateData as any).date = new Date(updateData.date);
    }
    
    const transaction = await TransactionModel.findByIdAndUpdate(id, updateData, { new: true })
      .populate('accountId')
      .populate('categoryId');
    
    return transaction ? this.transformTransactionWithDetails(transaction) : undefined;
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const session = await TransactionModel.startSession();
    
    try {
      let deletedCount = 0;
      
      await session.withTransaction(async () => {
        // Find the transaction to delete
        const transaction = await TransactionModel.findById(id).session(session);
        if (!transaction) {
          return;
        }
        
        // Check if this is a transfer transaction
        const isTransfer = transaction.description.startsWith('Transfer to ') || 
                          transaction.description.startsWith('Transfer from ');
        
        if (isTransfer) {
          // For transfers, we need to archive both transactions and revert account balances
          const amount = transaction.amount;
          const isFromTransaction = transaction.description.startsWith('Transfer to ');
          
          if (isFromTransaction) {
            // This is the "from" transaction (expense)
            // Find the corresponding "to" transaction (income)
            const transferInfo = transaction.description.match(/^Transfer to ([^:]+): (.+)$/);
            if (transferInfo) {
              const [, toAccountName, userDescription] = transferInfo;
              const toTransaction = await TransactionModel.findOne({
                amount: amount,
                type: 'income',
                description: { $regex: `^Transfer from .+: ${userDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
                date: transaction.date
              }).session(session);
              
              if (toTransaction) {
                // Archive both transactions
                await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: true }, { session });
                await TransactionModel.findByIdAndUpdate(toTransaction._id, { isArchived: true }, { session });
                
                // Revert account balances
                await Promise.all([
                  AccountModel.findByIdAndUpdate(transaction.accountId, { 
                    $inc: { balance: amount } // Add back the amount that was subtracted
                  }, { session }),
                  AccountModel.findByIdAndUpdate(toTransaction.accountId, { 
                    $inc: { balance: -amount } // Subtract the amount that was added
                  }, { session })
                ]);
                
                deletedCount = 2;
              } else {
                // Only archive this transaction if we can't find the pair
                await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: true }, { session });
                deletedCount = 1;
              }
            }
          } else {
            // This is the "to" transaction (income)
            // Find the corresponding "from" transaction (expense)
            const transferInfo = transaction.description.match(/^Transfer from ([^:]+): (.+)$/);
            if (transferInfo) {
              const [, fromAccountName, userDescription] = transferInfo;
              const fromTransaction = await TransactionModel.findOne({
                amount: amount,
                type: 'expense',
                description: { $regex: `^Transfer to .+: ${userDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
                date: transaction.date
              }).session(session);
              
              if (fromTransaction) {
                // Archive both transactions
                await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: true }, { session });
                await TransactionModel.findByIdAndUpdate(fromTransaction._id, { isArchived: true }, { session });
                
                // Revert account balances
                await Promise.all([
                  AccountModel.findByIdAndUpdate(fromTransaction.accountId, { 
                    $inc: { balance: amount } // Add back the amount that was subtracted
                  }, { session }),
                  AccountModel.findByIdAndUpdate(transaction.accountId, { 
                    $inc: { balance: -amount } // Subtract the amount that was added
                  }, { session })
                ]);
                
                deletedCount = 2;
              } else {
                // Only archive this transaction if we can't find the pair
                await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: true }, { session });
                deletedCount = 1;
              }
            }
          }
        } else {
          // Regular transaction - just archive it
          await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: true }, { session });
          deletedCount = 1;
        }
      });
      
      return deletedCount > 0;
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getArchivedTransactions(userId: string): Promise<TransactionWithDetails[]> {
    const transactions = await TransactionModel.find({ isArchived: true })
      .populate({
        path: 'accountId',
        match: { userId }
      })
      .populate('categoryId')
      .sort({ date: -1 });
    
    return transactions
      .filter(t => t.accountId) // Filter out transactions with null accountId (due to populate match)
      .map(t => this.transformTransactionWithDetails(t));
  }

  async restoreTransaction(id: string): Promise<boolean> {
    const session = await TransactionModel.startSession();
    
    try {
      let restoredCount = 0;
      
      await session.withTransaction(async () => {
        // Find the transaction to restore
        const transaction = await TransactionModel.findById(id).session(session);
        if (!transaction) {
          return;
        }
        
        // Check if this is a transfer transaction
        const isTransfer = transaction.description.startsWith('Transfer to ') || 
                          transaction.description.startsWith('Transfer from ');
        
        if (isTransfer) {
          // For transfers, we need to restore both transactions and reapply account balances
          const amount = transaction.amount;
          const isFromTransaction = transaction.description.startsWith('Transfer to ');
          
          if (isFromTransaction) {
            // This is the "from" transaction (expense)
            // Find the corresponding "to" transaction (income)
            const transferInfo = transaction.description.match(/^Transfer to ([^:]+): (.+)$/);
            if (transferInfo) {
              const [, toAccountName, userDescription] = transferInfo;
              const toTransaction = await TransactionModel.findOne({
                amount: amount,
                type: 'income',
                description: { $regex: `^Transfer from .+: ${userDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
                date: transaction.date
              }).session(session);
              
              if (toTransaction) {
                // Restore both transactions
                await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: false }, { session });
                await TransactionModel.findByIdAndUpdate(toTransaction._id, { isArchived: false }, { session });
                
                // Reapply account balances
                await Promise.all([
                  AccountModel.findByIdAndUpdate(transaction.accountId, { 
                    $inc: { balance: -amount } // Subtract the amount again
                  }, { session }),
                  AccountModel.findByIdAndUpdate(toTransaction.accountId, { 
                    $inc: { balance: amount } // Add the amount again
                  }, { session })
                ]);
                
                restoredCount = 2;
              } else {
                // Only restore this transaction if we can't find the pair
                await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: false }, { session });
                restoredCount = 1;
              }
            }
          } else {
            // This is the "to" transaction (income) - find the corresponding "from" transaction
            const transferInfo = transaction.description.match(/^Transfer from ([^:]+): (.+)$/);
            if (transferInfo) {
              const [, fromAccountName, userDescription] = transferInfo;
              const fromTransaction = await TransactionModel.findOne({
                amount: amount,
                type: 'expense',
                description: { $regex: `^Transfer to .+: ${userDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
                date: transaction.date
              }).session(session);
              
              if (fromTransaction) {
                // Restore both transactions
                await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: false }, { session });
                await TransactionModel.findByIdAndUpdate(fromTransaction._id, { isArchived: false }, { session });
                
                // Reapply account balances
                await Promise.all([
                  AccountModel.findByIdAndUpdate(fromTransaction.accountId, { 
                    $inc: { balance: -amount } // Subtract the amount again
                  }, { session }),
                  AccountModel.findByIdAndUpdate(transaction.accountId, { 
                    $inc: { balance: amount } // Add the amount again
                  }, { session })
                ]);
                
                restoredCount = 2;
              } else {
                // Only restore this transaction if we can't find the pair
                await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: false }, { session });
                restoredCount = 1;
              }
            }
          }
        } else {
          // Regular transaction - just restore it
          await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: false }, { session });
          restoredCount = 1;
        }
      });
      
      return restoredCount > 0;
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async permanentDeleteTransaction(id: string): Promise<boolean> {
    const session = await TransactionModel.startSession();
    
    try {
      let deletedCount = 0;
      
      await session.withTransaction(async () => {
        // Find the transaction to delete
        const transaction = await TransactionModel.findById(id).session(session);
        if (!transaction) {
          return;
        }
        
        // Check if this is a transfer transaction
        const isTransfer = transaction.description.startsWith('Transfer to ') || 
                          transaction.description.startsWith('Transfer from ');
        
        if (isTransfer) {
          // For transfers, we need to delete both transactions
          const amount = transaction.amount;
          const isFromTransaction = transaction.description.startsWith('Transfer to ');
          
          if (isFromTransaction) {
            // This is the "from" transaction (expense)
            // Find the corresponding "to" transaction (income)
            const transferInfo = transaction.description.match(/^Transfer to ([^:]+): (.+)$/);
            if (transferInfo) {
              const [, toAccountName, userDescription] = transferInfo;
              const toTransaction = await TransactionModel.findOne({
                amount: amount,
                type: 'income',
                description: { $regex: `^Transfer from .+: ${userDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
                date: transaction.date
              }).session(session);
              
              if (toTransaction) {
                // Delete both transactions permanently
                await TransactionModel.findByIdAndDelete(transaction._id).session(session);
                await TransactionModel.findByIdAndDelete(toTransaction._id).session(session);
                deletedCount = 2;
              } else {
                // Only delete this transaction if we can't find the pair
                await TransactionModel.findByIdAndDelete(transaction._id).session(session);
                deletedCount = 1;
              }
            }
          } else {
            // This is the "to" transaction (income)
            // Find the corresponding "from" transaction (expense)
            const transferInfo = transaction.description.match(/^Transfer from ([^:]+): (.+)$/);
            if (transferInfo) {
              const [, fromAccountName, userDescription] = transferInfo;
              const fromTransaction = await TransactionModel.findOne({
                amount: amount,
                type: 'expense',
                description: { $regex: `^Transfer to .+: ${userDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
                date: transaction.date
              }).session(session);
              
              if (fromTransaction) {
                // Delete both transactions permanently
                await TransactionModel.findByIdAndDelete(transaction._id).session(session);
                await TransactionModel.findByIdAndDelete(fromTransaction._id).session(session);
                deletedCount = 2;
              } else {
                // Only delete this transaction if we can't find the pair
                await TransactionModel.findByIdAndDelete(transaction._id).session(session);
                deletedCount = 1;
              }
            }
          }
        } else {
          // Regular transaction - just delete it permanently
          await TransactionModel.findByIdAndDelete(transaction._id).session(session);
          deletedCount = 1;
        }
      });
      
      return deletedCount > 0;
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // Helper methods to transform MongoDB documents to our interface types
  private transformUser(doc: any): User {
    return {
      _id: doc._id.toString(),
      username: doc.username,
      email: doc.email,
      password: doc.password,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  private transformAccount(doc: any): Account {
    return {
      _id: doc._id.toString(),
      name: doc.name,
      type: doc.type,
      balance: doc.balance,
      userId: doc.userId.toString(),
      isArchived: doc.isArchived || false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  private transformCategory(doc: any): Category {
    return {
      _id: doc._id.toString(),
      name: doc.name,
      color: doc.color,
      icon: doc.icon,
      userId: doc.userId.toString(),
      isArchived: doc.isArchived || false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  private transformTransaction(doc: any): Transaction {
    return {
      _id: doc._id.toString(),
      amount: doc.amount,
      description: doc.description,
      type: doc.type,
      date: doc.date,
      accountId: doc.accountId.toString(),
      categoryId: doc.categoryId.toString(),
      isArchived: doc.isArchived || false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  private transformTransactionWithDetails(doc: any): TransactionWithDetails {
    return {
      _id: doc._id.toString(),
      amount: doc.amount,
      description: doc.description,
      type: doc.type,
      date: doc.date,
      accountId: doc.accountId._id.toString(),
      categoryId: doc.categoryId._id.toString(),
      isArchived: doc.isArchived || false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      account: this.transformAccount(doc.accountId),
      category: this.transformCategory(doc.categoryId)
    };
  }

  // Transfer implementation
  async createTransfer(transfer: Transfer, userId: string): Promise<{ fromTransaction: TransactionWithDetails; toTransaction: TransactionWithDetails }> {
    const session = await TransactionModel.startSession();
    
    try {
      let fromTransaction: any, toTransaction: any;
      
      await session.withTransaction(async () => {
        const amount = parseFloat(transfer.amount);
        
        // Verify both accounts exist and belong to the user
        const [fromAccount, toAccount] = await Promise.all([
          AccountModel.findOne({ _id: transfer.fromAccountId, userId }).session(session),
          AccountModel.findOne({ _id: transfer.toAccountId, userId }).session(session)
        ]);

        if (!fromAccount || !toAccount) {
          throw new Error("One or both accounts not found or don't belong to you");
        }

        // Check if source account has sufficient balance
        if (fromAccount.balance < amount) {
          throw new Error("Insufficient balance in source account");
        }

        // Create or find a "Transfer" category
        let transferCategory = await CategoryModel.findOne({ name: "Transfer", userId }).session(session);
        if (!transferCategory) {
          const newCategories = await CategoryModel.create([{
            name: "Transfer",
            color: "#6366f1",
            icon: "fas fa-exchange-alt",
            userId
          }], { session });
          transferCategory = newCategories[0];
        }

        // Create debit transaction for source account
        const fromTransactionData = {
          amount: amount,
          description: `Transfer to ${toAccount.name}: ${transfer.description}`,
          type: "expense",
          date: new Date(transfer.date),
          accountId: transfer.fromAccountId,
          categoryId: transferCategory!._id.toString()
        };

        // Create credit transaction for destination account
        const toTransactionData = {
          amount: amount,
          description: `Transfer from ${fromAccount.name}: ${transfer.description}`,
          type: "income",
          date: new Date(transfer.date),
          accountId: transfer.toAccountId,
          categoryId: transferCategory!._id.toString()
        };

        // Create both transactions
        const [fromTxnArray, toTxnArray] = await Promise.all([
          TransactionModel.create([fromTransactionData], { session }),
          TransactionModel.create([toTransactionData], { session })
        ]);

        fromTransaction = fromTxnArray[0];
        toTransaction = toTxnArray[0];

        // Update account balances
        await Promise.all([
          AccountModel.findByIdAndUpdate(transfer.fromAccountId, { 
            $inc: { balance: -amount } 
          }, { session }),
          AccountModel.findByIdAndUpdate(transfer.toAccountId, { 
            $inc: { balance: amount } 
          }, { session })
        ]);
      });

      // Fetch the complete transaction details with populated data
      const [fromTxnPopulated, toTxnPopulated] = await Promise.all([
        TransactionModel.findById(fromTransaction._id)
          .populate('accountId')
          .populate('categoryId'),
        TransactionModel.findById(toTransaction._id)
          .populate('accountId')
          .populate('categoryId')
      ]);

      return {
        fromTransaction: this.transformTransactionWithDetails(fromTxnPopulated),
        toTransaction: this.transformTransactionWithDetails(toTxnPopulated)
      };

    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getRecentTransfers(userId: string) {
    const userAccounts = await AccountModel.find({ userId }).select('_id');
    const userAccountIds = userAccounts.map(a => a._id);

    const transfers = await TransactionModel.find({
      accountId: { $in: userAccountIds },
      type: 'expense',
      description: { $regex: /^Transfer to/ }
    })
    .sort({ date: -1 })
    .limit(5)
    .populate('accountId');

    return transfers;
  }
}

export const storage = new MongoDBStorage();
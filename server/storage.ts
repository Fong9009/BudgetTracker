import { UserModel, AccountModel, CategoryModel, TransactionModel, type User, type Account, type Category, type Transaction, type TransactionWithDetails, type RegisterUser, type InsertAccount, type InsertCategory, type InsertTransaction, type Transfer } from "@shared/schema";
import { hashPassword } from "./auth";
import { EncryptionService } from "./encryption";

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
  getCategoriesWithTransactionCounts(userId: string): Promise<(Category & { transactionCount: number })[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory, userId: string): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  getArchivedCategories(userId: string): Promise<Category[]>;
  restoreCategory(id: string): Promise<boolean>;
  permanentDeleteCategory(id: string): Promise<boolean>;

  // Transactions
  getTransactions(userId: string): Promise<TransactionWithDetails[]>;
  getTransactionsWithFilters(
    userId: string,
    filters: {
      search?: string;
      accountId?: string;
      categoryId?: string;
      type?: string;
      transactionKind?: string;
      dateFrom?: Date;
      dateTo?: Date;
      amountMin?: number;
      amountMax?: number;
    },
    sort: {
      field: string;
      order: 'asc' | 'desc';
    },
    pagination: {
      page: number;
      limit: number;
    }
  ): Promise<{
    transactions: TransactionWithDetails[];
    total: number;
    totalPages: number;
    currentPage: number;
  }>;
  getTransaction(id: string): Promise<TransactionWithDetails | undefined>;
  getTransactionsByAccount(accountId: string): Promise<TransactionWithDetails[]>;
  getTransactionsByCategory(categoryId: string): Promise<TransactionWithDetails[]>;
  createTransaction(transaction: InsertTransaction): Promise<TransactionWithDetails>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<TransactionWithDetails | undefined>;
  deleteTransaction(id: string): Promise<boolean>;
  getArchivedTransactions(userId: string): Promise<TransactionWithDetails[]>;
  restoreTransaction(id: string): Promise<boolean>;
  archiveTransactions(transactionIds: string[], userId: string): Promise<number>;
  restoreTransactions(transactionIds: string[], userId: string): Promise<number>;
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
    try {
      console.log("Storage: Starting user creation for:", userData.email);
      
      const hashedPassword = await hashPassword(userData.password);
      console.log("Storage: Password hashed successfully");
      
      // Remove confirmPassword and encrypt sensitive data before saving
      const { confirmPassword, ...userDataWithoutConfirm } = userData;
      console.log("Storage: Removed confirmPassword field");
      
      const encryptedUserData = EncryptionService.encryptObject({
        ...userDataWithoutConfirm,
        password: hashedPassword
      }, ['email']);
      console.log("Storage: Data encrypted successfully");
      
      console.log("Storage: Creating user in database...");
      const user = await UserModel.create(encryptedUserData);
      console.log("Storage: User created in database:", user._id);
      
      const transformedUser = this.transformUser(user);
      console.log("Storage: User transformed successfully");
      
      return transformedUser;
    } catch (error) {
      console.error("Storage: Error in createUser:", error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Since email is encrypted, we need to search differently
    // For now, we'll get all users and decrypt to find the match
    // In production, consider using a hash of the email for searching
    const users = await UserModel.find({});
    for (const user of users) {
      const decryptedUser = EncryptionService.decryptObject(user.toObject(), ['email']);
      if (decryptedUser.email === email) {
        return this.transformUser(user);
      }
    }
    return undefined;
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

    // Encrypt sensitive fields if they're being updated
    if (updatePayload.$set.email) {
      updatePayload.$set.email = EncryptionService.encrypt(updatePayload.$set.email);
    }

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
      initialBalance: parseFloat(insertAccount.initialBalance),
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
    if (updateData.initialBalance) {
      (updateData as any).initialBalance = parseFloat(updateData.initialBalance);
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

  async getCategoriesWithTransactionCounts(userId: string): Promise<(Category & { transactionCount: number })[]> {
    const categories = await CategoryModel.find({ userId, isArchived: { $ne: true } }).sort({ createdAt: -1 });
    
    // Get transaction counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const transactionCount = await TransactionModel.countDocuments({ 
          categoryId: category._id, 
          isArchived: false 
        });
        
        return {
          ...this.transformCategory(category),
          transactionCount
        };
      })
    );
    
    return categoriesWithCounts;
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
    const session = await CategoryModel.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Check if category exists
        const category = await CategoryModel.findById(id).session(session);
        if (!category) {
          throw new Error("Category not found");
        }
        
        // Count active transactions using this category
        const transactionCount = await TransactionModel.countDocuments({ 
          categoryId: id, 
          isArchived: false 
        }).session(session);
        
        if (transactionCount > 0) {
          // Create or find a "Uncategorized" category for reassignment
          let uncategorizedCategory = await CategoryModel.findOne({ 
            name: "Uncategorized", 
            userId: category.userId 
          }).session(session);
          
          if (!uncategorizedCategory) {
            const [newCategory] = await CategoryModel.create([{
              name: "Uncategorized",
              color: "#6b7280", // Gray color
              icon: "fas fa-question",
              userId: category.userId
            }], { session });
            uncategorizedCategory = newCategory;
          }
          
          // Reassign all active transactions to the "Uncategorized" category
          await TransactionModel.updateMany(
            { categoryId: id, isArchived: false },
            { categoryId: uncategorizedCategory._id },
            { session }
          );
        }
        
        // Archive the category
        await CategoryModel.findByIdAndUpdate(id, { isArchived: true }, { session });
      });
      
      return true;
    } catch (error) {
      console.error("Error archiving category:", error);
      throw error;
    } finally {
      await session.endSession();
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

  async getTransactionsWithFilters(
    userId: string,
    filters: {
      search?: string;
      accountId?: string;
      categoryId?: string;
      type?: string;
      transactionKind?: string;
      dateFrom?: Date;
      dateTo?: Date;
      amountMin?: number;
      amountMax?: number;
    },
    sort: {
      field: string;
      order: 'asc' | 'desc';
    },
    pagination: {
      page: number;
      limit: number;
    }
  ): Promise<{
    transactions: TransactionWithDetails[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    // Build the base query - transactions that belong to user's accounts
    const baseQuery: any = { 
      isArchived: { $ne: true },
      $or: [
        // Regular transactions where account belongs to user
        {
          accountId: { $in: await AccountModel.find({ userId }).distinct('_id') }
        },
        // Transfer transactions where either from or to account belongs to user
        {
          $and: [
            { description: { $regex: /^Transfer (to|from) / } },
            {
              $or: [
                { accountId: { $in: await AccountModel.find({ userId }).distinct('_id') } },
                // For transfers, we need to check if the other account in the transfer belongs to user
                // This is more complex and might require additional logic
              ]
            }
          ]
        }
      ]
    };

    // Add search filter
    if (filters.search) {
      baseQuery.$and = baseQuery.$and || [];
      baseQuery.$and.push({
        $or: [
          { description: { $regex: filters.search, $options: 'i' } },
          { type: { $regex: filters.search, $options: 'i' } }
        ]
      });
    }

    // Add account filter
    if (filters.accountId && filters.accountId !== 'all') {
      baseQuery.accountId = filters.accountId;
    }

    // Add category filter
    if (filters.categoryId && filters.categoryId !== 'all') {
      baseQuery.categoryId = filters.categoryId;
    }

    // Add type filter
    if (filters.type && filters.type !== 'all') {
      baseQuery.type = filters.type;
    }

    // Add transaction kind filter (transfer vs regular transaction)
    if (filters.transactionKind && filters.transactionKind !== 'all') {
      if (filters.transactionKind === 'transfer') {
        baseQuery.description = { $regex: /^Transfer (to|from) / };
      } else if (filters.transactionKind === 'transaction') {
        baseQuery.description = { $not: /^Transfer (to|from) / };
      }
    }

    // Add date range filter
    if (filters.dateFrom || filters.dateTo) {
      baseQuery.date = {};
      if (filters.dateFrom) {
        baseQuery.date.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        baseQuery.date.$lte = filters.dateTo;
      }
    }

    // Add amount range filter
    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      baseQuery.amount = {};
      if (filters.amountMin !== undefined) {
        baseQuery.amount.$gte = filters.amountMin;
      }
      if (filters.amountMax !== undefined) {
        baseQuery.amount.$lte = filters.amountMax;
      }
    }

    // Get total count for pagination
    const total = await TransactionModel.countDocuments(baseQuery);
    const totalPages = Math.ceil(total / pagination.limit);
    const currentPage = Math.max(1, Math.min(pagination.page, totalPages || 1));

    // Build sort object
    const sortObj: any = {};
    let sortField = sort.field;
    
    // Map frontend sort fields to database fields
    switch (sort.field) {
      case 'account':
        sortField = 'accountId';
        break;
      case 'category':
        sortField = 'categoryId';
        break;
      default:
        sortField = sort.field;
    }
    
    sortObj[sortField] = sort.order === 'asc' ? 1 : -1;

    // Calculate skip value with safety check
    const skip = Math.max(0, (currentPage - 1) * pagination.limit);

    // Fetch transactions with pagination
    const transactions = await TransactionModel.find(baseQuery)
      .populate({
        path: 'accountId',
        match: { userId }
      })
      .populate({
        path: 'categoryId',
        match: { userId }
      })
      .sort(sortObj)
      .skip(skip)
      .limit(pagination.limit);

    // Filter out transactions where account or category doesn't belong to user
    const userTransactions = transactions.filter(tx => tx.accountId && tx.categoryId);

    return {
      transactions: userTransactions.map(tx => this.transformTransactionWithDetails(tx)),
      total,
      totalPages,
      currentPage
    };
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
    try {
      // Try to use MongoDB transactions first
      const session = await TransactionModel.startSession();
      
      try {
        let transaction: any;
        
        await session.withTransaction(async () => {
          const transactionData = {
            ...insertTransaction,
            amount: parseFloat(insertTransaction.amount),
            date: new Date(insertTransaction.date)
          };
          
          // Create the transaction
          const [createdTransaction] = await TransactionModel.create([transactionData], { session });
          transaction = createdTransaction;
          
          // Update account balance based on transaction type
          const amount = transactionData.amount;
          const balanceUpdate = transactionData.type === 'income' ? amount : -amount;
          
          await AccountModel.findByIdAndUpdate(
            transactionData.accountId,
            { $inc: { balance: balanceUpdate } },
            { session }
          );
        });
        
        // Populate the created transaction
        const populatedTransaction = await TransactionModel.findById(transaction._id)
          .populate('accountId')
          .populate('categoryId');
        
        if (!populatedTransaction) {
          throw new Error("Failed to create transaction");
        }
        
        return this.transformTransactionWithDetails(populatedTransaction);
              } catch (error) {
          // If transactions are not supported (e.g., in-memory MongoDB), fall back to non-transactional approach
          if (error instanceof Error && error.message && error.message.includes('Transaction numbers are only allowed on a replica set')) {
          console.log('MongoDB transactions not supported, using fallback approach');
          
          const transactionData = {
            ...insertTransaction,
            amount: parseFloat(insertTransaction.amount),
            date: new Date(insertTransaction.date)
          };
          
          // Create the transaction without session
          const createdTransaction = await TransactionModel.create(transactionData);
          
          // Update account balance based on transaction type
          const amount = transactionData.amount;
          const balanceUpdate = transactionData.type === 'income' ? amount : -amount;
          
          await AccountModel.findByIdAndUpdate(
            transactionData.accountId,
            { $inc: { balance: balanceUpdate } }
          );

          // Populate the created transaction
          const populatedTransaction = await TransactionModel.findById(createdTransaction._id)
            .populate('accountId')
            .populate('categoryId');
          
          if (!populatedTransaction) {
            throw new Error("Failed to create transaction");
          }
          
          return this.transformTransactionWithDetails(populatedTransaction);
        }
        
        throw error;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  async updateTransaction(id: string, updates: Partial<InsertTransaction>): Promise<TransactionWithDetails | undefined> {
    const session = await TransactionModel.startSession();
    
    try {
      let updatedTransaction: any;
      
      await session.withTransaction(async () => {
        // Get the original transaction to calculate balance changes
        const originalTransaction = await TransactionModel.findById(id).session(session);
        if (!originalTransaction) {
          throw new Error("Transaction not found");
        }
        
        const updateData = { ...updates };
        if (updateData.amount) {
          (updateData as any).amount = parseFloat(updateData.amount);
        }
        if (updateData.date) {
          (updateData as any).date = new Date(updateData.date);
        }
        
        // Calculate balance changes if amount or type changed
        let balanceChange = 0;
        const newAmount = updateData.amount !== undefined ? parseFloat(updateData.amount.toString()) : originalTransaction.amount;
        const newType = updateData.type !== undefined ? updateData.type : originalTransaction.type;
        
        // Calculate the difference in balance impact
        const originalBalanceImpact = originalTransaction.type === 'income' ? originalTransaction.amount : -originalTransaction.amount;
        const newBalanceImpact = newType === 'income' ? newAmount : -newAmount;
        balanceChange = newBalanceImpact - originalBalanceImpact;
        
        // Update the transaction
        updatedTransaction = await TransactionModel.findByIdAndUpdate(id, updateData, { new: true, session })
          .populate('accountId')
          .populate('categoryId');
        
        // Update account balance if there's a change
        if (balanceChange !== 0) {
          await AccountModel.findByIdAndUpdate(
            originalTransaction.accountId,
            { $inc: { balance: balanceChange } },
            { session }
          );
        }
      });
      
      return updatedTransaction ? this.transformTransactionWithDetails(updatedTransaction) : undefined;
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
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
          // Regular transaction - archive it and revert account balance
          await TransactionModel.findByIdAndUpdate(transaction._id, { isArchived: true }, { session });
          
          // Revert account balance based on transaction type
          const amount = transaction.amount;
          const balanceUpdate = transaction.type === 'income' ? -amount : amount; // Reverse the original effect
          
          await AccountModel.findByIdAndUpdate(
            transaction.accountId,
            { $inc: { balance: balanceUpdate } },
            { session }
          );
          
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
      await session.withTransaction(async () => {
        const transaction = await TransactionModel.findById(id).session(session);
        if (!transaction) {
          throw new Error("Transaction not found");
        }

        if (!transaction.isArchived) {
          throw new Error("Transaction is not archived");
        }

        // Restore the transaction
        await TransactionModel.findByIdAndUpdate(id, { isArchived: false }, { session });

        // Reapply account balance based on transaction type
        const amount = transaction.amount;
        const balanceUpdate = transaction.type === 'income' ? amount : -amount; // Reapply the original effect

        await AccountModel.findByIdAndUpdate(
          transaction.accountId,
          { $inc: { balance: balanceUpdate } },
          { session }
        );
      });
      return true;
    } catch (error) {
      console.error("Error restoring transaction:", error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async archiveTransactions(transactionIds: string[], userId: string): Promise<number> {
    const session = await TransactionModel.startSession();
    let archivedCount = 0;

    try {
      await session.withTransaction(async () => {
        for (const transactionId of transactionIds) {
          const transaction = await TransactionModel.findById(transactionId).session(session);
          if (!transaction) {
            continue;
          }

          // Check if transaction belongs to user by checking the account's userId
          const account = await AccountModel.findById(transaction.accountId).session(session);
          if (!account || account.userId.toString() !== userId) {
            throw new Error(`Transaction with ID ${transactionId} does not belong to user ${userId}`);
          }

          // Check if transaction is already archived
          if (transaction.isArchived) {
            continue;
          }

          // Archive the transaction
          await TransactionModel.findByIdAndUpdate(transactionId, { isArchived: true }, { session });

          // Revert account balance based on transaction type
          const amount = transaction.amount;
          const balanceUpdate = transaction.type === 'income' ? -amount : amount; // Reverse the original effect

          await AccountModel.findByIdAndUpdate(
            transaction.accountId,
            { $inc: { balance: balanceUpdate } },
            { session }
          );
          archivedCount++;
        }
      });
      return archivedCount;
    } catch (error) {
      console.error("Error archiving transactions:", error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async restoreTransactions(transactionIds: string[], userId: string): Promise<number> {
    const session = await TransactionModel.startSession();
    let restoredCount = 0;

    try {
      await session.withTransaction(async () => {
        for (const transactionId of transactionIds) {
          const transaction = await TransactionModel.findById(transactionId).session(session);
          if (!transaction) {
            continue;
          }

          // Check if transaction belongs to user by checking the account's userId
          const account = await AccountModel.findById(transaction.accountId).session(session);
          if (!account || account.userId.toString() !== userId) {
            throw new Error(`Transaction with ID ${transactionId} does not belong to user ${userId}`);
          }

          // Check if transaction is already restored
          if (!transaction.isArchived) {
            continue;
          }

          // Restore the transaction
          await TransactionModel.findByIdAndUpdate(transactionId, { isArchived: false }, { session });

          // Reapply account balance based on transaction type
          const amount = transaction.amount;
          const balanceUpdate = transaction.type === 'income' ? amount : -amount; // Reapply the original effect

          await AccountModel.findByIdAndUpdate(
            transaction.accountId,
            { $inc: { balance: balanceUpdate } },
            { session }
          );
          restoredCount++;
        }
      });
      return restoredCount;
    } catch (error) {
      console.error("Error restoring transactions:", error);
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
    // Decrypt sensitive fields if they're encrypted
    const decryptedDoc = EncryptionService.decryptObject(doc.toObject(), ['email']);
    
    return {
      _id: decryptedDoc._id.toString(),
      username: decryptedDoc.username,
      email: decryptedDoc.email,
      password: decryptedDoc.password,
      createdAt: decryptedDoc.createdAt,
      updatedAt: decryptedDoc.updatedAt
    };
  }

  private transformAccount(doc: any): Account {
    return {
      _id: doc._id.toString(),
      name: doc.name,
      type: doc.type,
      balance: doc.balance,
      initialBalance: doc.initialBalance || doc.balance, // Fallback to balance for existing accounts
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

  // Test helper method
  async clearTestData(): Promise<void> {
    try {
      await TransactionModel.deleteMany({});
      await AccountModel.deleteMany({});
      await CategoryModel.deleteMany({});
      // Don't delete users to keep auth token valid
    } catch (error) {
      console.error("Error clearing test data:", error);
    }
  }
}

export const storage = new MongoDBStorage();
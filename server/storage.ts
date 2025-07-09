import { UserModel, AccountModel, CategoryModel, TransactionModel, type User, type Account, type Category, type Transaction, type TransactionWithDetails, type RegisterUser, type InsertAccount, type InsertCategory, type InsertTransaction, type Transfer } from "@shared/schema";
import { hashPassword } from "./auth";

export interface IStorage {
  // Users
  createUser(user: RegisterUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Accounts
  getAccounts(userId: string): Promise<Account[]>;
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount, userId: string): Promise<Account>;
  updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: string): Promise<boolean>;

  // Categories
  getCategories(userId: string): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory, userId: string): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // Transactions
  getTransactions(userId: string): Promise<TransactionWithDetails[]>;
  getTransaction(id: string): Promise<TransactionWithDetails | undefined>;
  getTransactionsByAccount(accountId: string): Promise<TransactionWithDetails[]>;
  getTransactionsByCategory(categoryId: string): Promise<TransactionWithDetails[]>;
  createTransaction(transaction: InsertTransaction): Promise<TransactionWithDetails>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<TransactionWithDetails | undefined>;
  deleteTransaction(id: string): Promise<boolean>;

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

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = await UserModel.findByIdAndUpdate(
      id, 
      { 
        ...updates,
        updatedAt: new Date()
      }, 
      { new: true }
    );
    return user ? this.transformUser(user) : undefined;
  }

  // Account methods
  async getAccounts(userId: string): Promise<Account[]> {
    const accounts = await AccountModel.find({ userId }).sort({ createdAt: -1 });
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
    const result = await AccountModel.findByIdAndDelete(id);
    return !!result;
  }

  // Category methods
  async getCategories(userId: string): Promise<Category[]> {
    const categories = await CategoryModel.find({ userId }).sort({ createdAt: -1 });
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
    const result = await CategoryModel.findByIdAndDelete(id);
    return !!result;
  }

  // Transaction methods
  async getTransactions(userId: string): Promise<TransactionWithDetails[]> {
    const transactions = await TransactionModel.find()
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
    const result = await TransactionModel.findByIdAndDelete(id);
    return !!result;
  }

  // Helper methods to transform MongoDB documents to our interface types
  private transformUser(doc: any): User {
    return {
      _id: doc._id.toString(),
      username: doc.username,
      email: doc.email,
      password: doc.password,
      profileImageUrl: doc.profileImageUrl,
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
          transferCategory = await CategoryModel.create([{
            name: "Transfer",
            color: "#6366f1",
            icon: "fas fa-exchange-alt",
            userId
          }], { session });
          transferCategory = transferCategory[0];
        }

        // Create debit transaction for source account
        const fromTransactionData = {
          amount: amount,
          description: `Transfer to ${toAccount.name}: ${transfer.description}`,
          type: "expense",
          date: new Date(transfer.date),
          accountId: transfer.fromAccountId,
          categoryId: transferCategory._id.toString()
        };

        // Create credit transaction for destination account
        const toTransactionData = {
          amount: amount,
          description: `Transfer from ${fromAccount.name}: ${transfer.description}`,
          type: "income",
          date: new Date(transfer.date),
          accountId: transfer.toAccountId,
          categoryId: transferCategory._id.toString()
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
}

export const storage = new MongoDBStorage();
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertCategorySchema, insertTransactionSchema, transferSchema, registerUserSchema, loginUserSchema } from "@shared/schema";
import { authMiddleware, generateToken, comparePassword, hashPassword, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import { sendEmail } from "./mail";
import crypto from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = registerUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }
      
      const user = await storage.createUser(validatedData);
      const token = generateToken(user._id);
      
      res.status(201).json({
        message: "User created successfully",
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginUserSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      const isPasswordValid = await comparePassword(validatedData.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      const token = generateToken(user._id);
      
      res.json({
        message: "Login successful",
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid login data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
    res.json({
      user: req.user
    });
  });

  app.put("/api/auth/profile", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }

      const { username, email } = req.body;

      // Basic validation
      if (username && username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (email && !/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ message: "Please enter a valid email" });
      }

      // Check if email is already taken by another user
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser._id.toString() !== userId) {
          return res.status(400).json({ message: "Email is already taken" });
        }
      }

      const updatedUser = await storage.updateUser(userId, { 
        username, 
        email, 
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        message: "Profile updated successfully",
        user: {
          id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
        }
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put("/api/auth/change-password", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);
      
      const updatedUser = await storage.updateUser(userId, { 
        password: hashedNewPassword 
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        message: "Password changed successfully"
      });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(200).json({ message: "If a user with that email exists, a password reset link has been sent." });
      }

      const resetToken = crypto.randomBytes(20).toString('hex');
      const resetPasswordExpires = new Date(Date.now() + 3600000);

      await storage.updateUser(user._id, {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetPasswordExpires,
      });

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

      const message = `
        <h1>You have requested a password reset</h1>
        <p>Please go to this link to reset your password:</p>
        <a href="${resetUrl}" target="_blank">${resetUrl}</a>
        <p>This link will expire in one hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `;

      try {
        await sendEmail({
          to: user.email,
          subject: 'Password Reset Request',
          text: `Please use the following link to reset your password: ${resetUrl}`,
          html: message,
        });

        res.status(200).json({ message: "If a user with that email exists, a password reset link has been sent." });
      } catch (err) {
        console.error(err);
        await storage.updateUser(user._id, {
          resetPasswordToken: undefined,
          resetPasswordExpires: undefined,
        });
        res.status(500).json({ message: "Error sending password reset email." });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required." });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
      }

      const user = await storage.getUserByResetToken(token);

      if (!user) {
        return res.status(400).json({ message: "Password reset token is invalid or has expired." });
      }

      const hashedPassword = await hashPassword(password);

      await storage.updateUser(user._id, {
        password: hashedPassword,
        resetPasswordToken: undefined,
        resetPasswordExpires: undefined,
      });

      res.status(200).json({ message: "Password has been reset successfully." });

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Account routes (protected)
  app.get("/api/accounts", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const accounts = await storage.getAccounts(req.user!._id);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  app.get("/api/accounts/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const account = await storage.getAccount(id);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch account" });
    }
  });

  app.post("/api/accounts", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertAccountSchema.parse(req.body);
      const account = await storage.createAccount(validatedData, req.user!._id);
      res.status(201).json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid account data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.put("/api/accounts/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const validatedData = insertAccountSchema.partial().parse(req.body);
      const account = await storage.updateAccount(id, validatedData);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid account data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update account" });
    }
  });

  app.delete("/api/accounts/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteAccount(id);
      if (!deleted) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.get("/api/transfers/recent", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const transfers = await storage.getRecentTransfers(req.user!._id);
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent transfers" });
    }
  });

  // Category routes (protected)
  app.get("/api/categories", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const categories = await storage.getCategories(req.user!._id);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData, req.user!._id);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const validatedData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(id, validatedData);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteCategory(id);
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Transaction routes (protected)
  app.get("/api/transactions", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const transactions = await storage.getTransactions(req.user!._id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });

  app.post("/api/transactions", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  app.put("/api/transactions/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const validatedData = insertTransactionSchema.partial().parse(req.body);
      const transaction = await storage.updateTransaction(id, validatedData);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  app.delete("/api/transactions/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteTransaction(id);
      if (!deleted) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Transfer routes (protected)
  app.post("/api/transfers", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = transferSchema.parse(req.body);
      const result = await storage.createTransfer(validatedData, req.user!._id);
      res.status(201).json({
        message: "Transfer completed successfully",
        fromTransaction: result.fromTransaction,
        toTransaction: result.toTransaction
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transfer data", errors: error.errors });
      }
      if (error instanceof Error) {
        if (error.message.includes("not found") || error.message.includes("don't belong")) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes("Insufficient balance")) {
          return res.status(400).json({ message: error.message });
        }
      }
      res.status(500).json({ message: "Failed to process transfer" });
    }
  });

  // Analytics routes (protected)
  app.get("/api/analytics/summary", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!._id;
      const accounts = await storage.getAccounts(userId);
      const transactions = await storage.getTransactions(userId);
      
      const totalBalance = accounts.reduce((sum, account) => {
        return sum + parseFloat(account.balance.toString());
      }, 0);

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const currentMonthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear;
      });

      const monthlyIncome = currentMonthTransactions
        .filter(t => t.type === 'income' && t.category.name !== 'Transfer')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      const monthlyExpenses = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.category.name !== 'Transfer')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

      res.json({
        totalBalance: totalBalance.toFixed(2),
        monthlyIncome: monthlyIncome.toFixed(2),
        monthlyExpenses: monthlyExpenses.toFixed(2),
        savingsRate: savingsRate.toFixed(1),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch summary" });
    }
  });

  app.get("/api/analytics/spending-by-category", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!._id;
      const categories = await storage.getCategories(userId);
      const transactions = await storage.getTransactions(userId);

      // Get current month transactions for spending analysis
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const currentMonthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear;
      });

      const spendingByCategory = categories
        .filter(category => category.name !== 'Transfer') // Exclude transfer category
        .map(category => {
          const categoryTransactions = currentMonthTransactions
            .filter(t => t.category._id.toString() === category._id.toString() && t.type === 'expense');
          
          const total = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
          
          return {
            id: parseInt(category._id.toString().slice(-8), 16), // Convert ObjectId to number for frontend
            name: category.name,
            amount: total.toFixed(2),
            color: category.color,
            icon: category.icon,
            transactionCount: categoryTransactions.length
          };
        })
        .filter(category => parseFloat(category.amount) > 0); // Only include categories with spending

      res.json(spendingByCategory);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch spending by category" });
    }
  });

  // Export routes (protected)
  app.post("/api/export", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { type } = req.body;
      // In a real application, you would generate and send the export file here
      // For example, if type is 'csv', you might generate a CSV string and send it as a file attachment.
      // This is a placeholder for actual export logic.
      res.status(200).json({ message: "Export functionality not yet implemented." });
    } catch (error) {
      res.status(500).json({ message: "Failed to process export request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

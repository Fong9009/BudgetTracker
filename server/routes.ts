import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertAccountSchema, 
  insertCategorySchema, 
  insertTransactionSchema, 
  transferSchema, 
  registerUserSchema, 
  loginUserSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateAccountSchema,
  updateCategorySchema,
  updateTransactionSchema,
  transactionFiltersSchema,
  paginationSchema
} from "@shared/schema";
import { authMiddleware, generateTokenPair, comparePassword, hashPassword, refreshTokenMiddleware, logoutMiddleware, type AuthenticatedRequest } from "./auth";
import { validateRequest, validateQuery, validateRequestAndQuery, handleValidationError } from "./validation";
import { z } from "zod";
import { sendEmail } from "./mail";
import crypto from "crypto";
import { EncryptionService } from "./encryption";
import { CSVParser } from './csv-parser';
import { ExcelParser } from './excel-parser';
import multer from 'multer';

// Enhanced security configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Reduced to 5MB for security
    files: 1, // Only allow 1 file per request
    fieldSize: 1024 * 1024, // 1MB field size limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Support CSV and Excel files
    const allowedMimeTypes = [
      'text/csv', 
      'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    
    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only CSV and Excel files are allowed'), false);
    }
    
    // Check file extension
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      return cb(new Error('Invalid file extension. Please use .csv or .xlsx files'), false);
    }
    
    // Check for suspicious file names
    const suspiciousPatterns = [
      /\.\./, // Directory traversal
      /[<>:"|?*]/, // Invalid characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Reserved names
      /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|war|ear|apk|dmg|iso|zip|rar|7z|tar|gz)$/i, // Executable/archive files
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(file.originalname)) {
        return cb(new Error('Suspicious file name detected'), false);
      }
    }
    
    // File size validation (double-check)
    if (file.size > 5 * 1024 * 1024) {
      return cb(new Error('File too large'), false);
    }
    
    cb(null, true);
  },
});

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected"
        }
      });
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed"
      });
    }
  });

  // Test encryption endpoint
  app.get("/api/test-encryption", (req, res) => {
    try {
      const testData = "test@example.com";
      const encrypted = EncryptionService.encrypt(testData);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      res.json({
        success: true,
        original: testData,
        encrypted: encrypted,
        decrypted: decrypted,
        matches: testData === decrypted
      });
    } catch (error) {
      console.error("Encryption test error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test MongoDB endpoint
  app.get("/api/test-mongodb", async (req, res) => {
    try {
      const { UserModel } = await import("@shared/schema");
      const userCount = await UserModel.countDocuments();
      
      res.json({
        success: true,
        userCount: userCount,
        message: "MongoDB connection working"
      });
    } catch (error) {
      console.error("MongoDB test error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Authentication routes
  app.post("/api/auth/register", validateRequest(registerUserSchema), async (req, res) => {
    try {
      const validatedData = req.body;
      console.log("Registration attempt for:", validatedData.email);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        console.log("User already exists:", validatedData.email);
        return res.status(400).json({ message: "User already exists with this email" });
      }
      
      console.log("Creating user...");
      const user = await storage.createUser(validatedData);
      console.log("User created successfully:", user._id);
      
      console.log("Generating token pair...");
      const tokenPair = generateTokenPair(user._id);
      console.log("Token pair generated successfully");
      
      console.log("Sending success response...");
      res.status(201).json({
        message: "User created successfully",
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
      console.log("Registration completed successfully");
    } catch (error) {
      console.error("Registration error details:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", validateRequest(loginUserSchema), async (req, res) => {
    try {
      const validatedData = req.body;
      
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      const isPasswordValid = await comparePassword(validatedData.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      const tokenPair = generateTokenPair(user._id);
      
      res.json({
        message: "Login successful",
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
    res.json({
      user: req.user
    });
  });

  app.post("/api/auth/refresh", refreshTokenMiddleware);

  app.post("/api/auth/logout", authMiddleware, logoutMiddleware);

  app.put("/api/auth/profile", authMiddleware, validateRequest(updateProfileSchema), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }

      const { username, email } = req.body;

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

  app.put("/api/auth/change-password", authMiddleware, validateRequest(changePasswordSchema), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }

      const { currentPassword, newPassword } = req.body;

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

  app.post("/api/auth/forgot-password", validateRequest(forgotPasswordSchema), async (req, res) => {
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

  app.post("/api/auth/reset-password", validateRequest(resetPasswordSchema), async (req, res) => {
    try {
      const { token, password } = req.body;

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

  // Account archive routes (must be before parameterized routes)
  app.get("/api/accounts/archived", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const archivedAccounts = await storage.getArchivedAccounts(req.user!._id);
      res.json(archivedAccounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch archived accounts" });
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

  app.post("/api/accounts", authMiddleware, validateRequest(insertAccountSchema), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = req.body;
      const account = await storage.createAccount(validatedData, req.user!._id);
      res.status(201).json(account);
    } catch (error) {
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.put("/api/accounts/:id", authMiddleware, validateRequest(updateAccountSchema), async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const validatedData = req.body;
      const account = await storage.updateAccount(id, validatedData);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.json(account);
    } catch (error) {
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
    } catch (error: any) {
      console.error("Archive account error:", error);
      if (error.message && error.message.includes("Cannot archive account")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to archive account" });
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

  app.get("/api/categories/with-counts", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const categoriesWithCounts = await storage.getCategoriesWithTransactionCounts(req.user!._id);
      res.json(categoriesWithCounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories with transaction counts" });
    }
  });

  // Category archive routes (must be before parameterized routes)
  app.get("/api/categories/archived", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const archivedCategories = await storage.getArchivedCategories(req.user!._id);
      res.json(archivedCategories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch archived categories" });
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

  app.post("/api/categories", authMiddleware, validateRequest(insertCategorySchema), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = req.body;
      const category = await storage.createCategory(validatedData, req.user!._id);
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", authMiddleware, validateRequest(updateCategorySchema), async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const validatedData = req.body;
      const category = await storage.updateCategory(id, validatedData);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
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
    } catch (error: any) {
      console.error("Archive category error:", error);
      if (error.message && error.message.includes("Cannot archive category")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to archive category" });
    }
  });

  // Archive routes (protected)
  // Account archive routes (restore and permanent delete)
  app.post("/api/accounts/:id/restore", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const restored = await storage.restoreAccount(id);
      if (!restored) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to restore account" });
    }
  });

  app.delete("/api/accounts/:id/permanent", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.permanentDeleteAccount(id);
      if (!deleted) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error("Permanent delete account error:", error);
      if (error.message && error.message.includes("Cannot permanently delete account")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to permanently delete account" });
    }
  });

  // Restore all accounts endpoint
  app.post("/api/accounts/restore-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { accountIds } = req.body;
      
      if (!Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({ message: "Invalid account IDs provided" });
      }

      const userId = req.user!._id;
      const restoredCount = await storage.restoreAllAccounts(accountIds, userId);
      
      res.json({ 
        message: `Successfully restored ${restoredCount} accounts`,
        restoredCount 
      });
    } catch (error) {
      console.error("Restore all accounts error:", error);
      res.status(500).json({ message: "Failed to restore accounts" });
    }
  });

  // Delete all accounts endpoint
  app.post("/api/accounts/delete-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { accountIds } = req.body;
      
      if (!Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({ message: "Invalid account IDs provided" });
      }

      const userId = req.user!._id;
      const deletedCount = await storage.permanentDeleteAllAccounts(accountIds, userId);
      
      res.json({ 
        message: `Successfully deleted ${deletedCount} accounts`,
        deletedCount 
      });
    } catch (error) {
      console.error("Delete all accounts error:", error);
      res.status(500).json({ message: "Failed to delete accounts" });
    }
  });

  // Category archive routes (restore and permanent delete)
  app.post("/api/categories/:id/restore", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const restored = await storage.restoreCategory(id);
      if (!restored) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to restore category" });
    }
  });

  app.delete("/api/categories/:id/permanent", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.permanentDeleteCategory(id);
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error("Permanent delete category error:", error);
      if (error.message && error.message.includes("Cannot permanently delete category")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to permanently delete category" });
    }
  });

  // Restore all categories endpoint
  app.post("/api/categories/restore-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { categoryIds } = req.body;
      
      if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({ message: "Invalid category IDs provided" });
      }

      const userId = req.user!._id;
      const restoredCount = await storage.restoreAllCategories(categoryIds, userId);
      
      res.json({ 
        message: `Successfully restored ${restoredCount} categories`,
        restoredCount 
      });
    } catch (error) {
      console.error("Restore all categories error:", error);
      res.status(500).json({ message: "Failed to restore categories" });
    }
  });

  // Delete all categories endpoint
  app.post("/api/categories/delete-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { categoryIds } = req.body;
      
      if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({ message: "Invalid category IDs provided" });
      }

      const userId = req.user!._id;
      const deletedCount = await storage.permanentDeleteAllCategories(categoryIds, userId);
      
      res.json({ 
        message: `Successfully deleted ${deletedCount} categories`,
        deletedCount 
      });
    } catch (error) {
      console.error("Delete all categories error:", error);
      res.status(500).json({ message: "Failed to delete categories" });
    }
  });

  // Transaction archive routes (restore and permanent delete)
  app.post("/api/transactions/:id/restore", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const restored = await storage.restoreTransaction(id);
      if (!restored) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to restore transaction" });
    }
  });

  app.delete("/api/transactions/:id/permanent", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.permanentDeleteTransaction(id);
      if (!deleted) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to permanently delete transaction" });
    }
  });

  // Transaction routes (protected)
  app.get("/api/transactions", authMiddleware, validateQuery(transactionFiltersSchema), async (req: AuthenticatedRequest, res) => {
    try {
      // Parse query parameters with validation
      const {
        search,
        accountId,
        categoryId,
        type,
        transactionKind,
        dateFrom,
        dateTo,
        amountMin,
        amountMax,
        sortBy = 'date',
        sortOrder = 'desc',
        page = '1',
        limit = '50'
      } = req.query;

      // Parse pagination with validation
  
      const paginationData = paginationSchema.parse({ page, limit });

      // Parse filters
      const filters = {
        search: search as string,
        accountId: accountId as string,
        categoryId: categoryId as string,
        type: type as string,
        transactionKind: transactionKind as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        amountMin: amountMin ? parseFloat(amountMin as string) : undefined,
        amountMax: amountMax ? parseFloat(amountMax as string) : undefined,
      };

      // Parse sort
      const sort = {
        field: sortBy as string,
        order: (sortOrder as string) === 'asc' ? 'asc' : 'desc' as 'asc' | 'desc'
      };

      const result = await storage.getTransactionsWithFilters(
        req.user!._id,
        filters,
        sort,
        paginationData
      );

      res.json(result);
    } catch (error) {
      console.error("Transactions route error:", error);
      if (error instanceof z.ZodError) {
        console.error("Zod validation error:", error.errors);
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Transaction archive routes (must be before parameterized routes)
  app.get("/api/transactions/archived", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const archivedTransactions = await storage.getArchivedTransactions(req.user!._id);
      res.json(archivedTransactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch archived transactions" });
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

  app.post("/api/transactions", authMiddleware, validateRequest(insertTransactionSchema), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = req.body;
      console.log('Creating transaction with data:', validatedData);
      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error('Transaction creation error:', error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  app.put("/api/transactions/:id", authMiddleware, validateRequest(updateTransactionSchema), async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      const validatedData = req.body;
      const transaction = await storage.updateTransaction(id, validatedData);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
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

  // Archive all transactions endpoint
  app.post("/api/transactions/archive-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { transactionIds } = req.body;
      
      if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ message: "Invalid transaction IDs provided" });
      }

      const userId = req.user!._id;
      const archivedCount = await storage.archiveTransactions(transactionIds, userId);
      
      res.json({ 
        message: `Successfully archived ${archivedCount} transactions`,
        archivedCount 
      });
    } catch (error) {
      console.error("Archive all transactions error:", error);
      res.status(500).json({ message: "Failed to archive transactions" });
    }
  });

  // Restore all transactions endpoint
  app.post("/api/transactions/restore-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { transactionIds } = req.body;
      
      if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ message: "Invalid transaction IDs provided" });
      }

      const userId = req.user!._id;
      const restoredCount = await storage.restoreTransactions(transactionIds, userId);
      
      res.json({ 
        message: `Successfully restored ${restoredCount} transactions`,
        restoredCount 
      });
    } catch (error) {
      console.error("Restore all transactions error:", error);
      res.status(500).json({ message: "Failed to restore transactions" });
    }
  });

  // Delete all transactions endpoint
  app.post("/api/transactions/delete-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      console.log("Delete all transactions request body:", req.body);
      console.log("Request headers:", req.headers);
      
      if (!req.body || !req.body.transactionIds) {
        console.log("No request body or transactionIds found");
        return res.status(400).json({ message: "Request body with transactionIds is required" });
      }
      
      const { transactionIds } = req.body;
      
      console.log("Transaction IDs:", transactionIds);
      console.log("User ID:", req.user!._id);
      
      if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ message: "Invalid transaction IDs provided" });
      }

      const userId = req.user!._id;
      const deletedCount = await storage.permanentDeleteTransactions(transactionIds, userId);
      
      console.log("Deleted count:", deletedCount);
      
      res.json({ 
        message: `Successfully deleted ${deletedCount} transactions`,
        deletedCount 
      });
    } catch (error) {
      console.error("Delete all transactions error:", error);
      res.status(500).json({ message: "Failed to delete transactions" });
    }
  });

  // Transfer routes (protected)
  app.post("/api/transfers", authMiddleware, validateRequest(transferSchema), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = req.body;
      const result = await storage.createTransfer(validatedData, req.user!._id);
      res.status(201).json({
        message: "Transfer completed successfully",
        fromTransaction: result.fromTransaction,
        toTransaction: result.toTransaction
      });
    } catch (error) {
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

  app.get("/api/analytics/spending-data", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!._id;
      const categories = await storage.getCategories(userId);
      const transactions = await storage.getTransactions(userId);

      // Get current week transactions (Monday to Sunday)
      const today = new Date();
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for Sunday
      startOfWeek.setDate(today.getDate() - daysToSubtract);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      const currentWeekTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startOfWeek && transactionDate <= endOfWeek;
      });

      // Get previous week transactions for comparison
      const startOfPreviousWeek = new Date(startOfWeek);
      startOfPreviousWeek.setDate(startOfWeek.getDate() - 7);
      
      const endOfPreviousWeek = new Date(startOfWeek);
      endOfPreviousWeek.setDate(startOfWeek.getDate() - 1);
      endOfPreviousWeek.setHours(23, 59, 59, 999);
      
      const previousWeekTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startOfPreviousWeek && transactionDate <= endOfPreviousWeek;
      });

      // Calculate current week spending
      const currentWeekSpending = currentWeekTransactions
        .filter(t => t.type === 'expense' && t.category.name !== 'Transfer')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      // Calculate previous week spending
      const previousWeekSpending = previousWeekTransactions
        .filter(t => t.type === 'expense' && t.category.name !== 'Transfer')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      // Calculate spending change percentage
      const spendingChange = previousWeekSpending > 0 
        ? ((currentWeekSpending - previousWeekSpending) / previousWeekSpending) * 100 
        : 0;

      // Calculate category spending with weekly budget percentages
      const categorySpending = categories
        .filter(category => category.name !== 'Transfer')
        .map(category => {
          const categoryTransactions = currentWeekTransactions
            .filter(t => t.category._id.toString() === category._id.toString() && t.type === 'expense');
          
          const spent = categoryTransactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
          
          // Weekly budget per category (monthly budget / 4 weeks)
          const weeklyBudget = 125; // $500 monthly / 4 weeks
          const percentage = (spent / weeklyBudget) * 100;
          
          return {
            category: category.name,
            spent: spent,
            budget: weeklyBudget,
            percentage: percentage
          };
        })
        .filter(category => category.spent > 0); // Only include categories with spending

      // Weekly budget (monthly budget / 4 weeks)
      const weeklyBudget = 500; // $2000 monthly / 4 weeks

      res.json({
        totalSpent: currentWeekSpending,
        monthlyBudget: weeklyBudget * 4, // Keep for compatibility
        weeklyBudget: weeklyBudget,
        categorySpending: categorySpending,
        previousWeekSpending: previousWeekSpending,
        spendingChange: spendingChange,
        weekStart: startOfWeek.toISOString(),
        weekEnd: endOfWeek.toISOString()
      });
    } catch (error) {
      console.error("Error fetching spending data:", error);
      res.status(500).json({ message: "Failed to fetch spending data" });
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

  // Enhanced file upload security middleware
  const validateFileUpload = (req: any, res: any, next: any) => {
    // Rate limiting for file uploads (per user)
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user has exceeded upload limits
    const uploadKey = `upload_limit_${userId}`;
    const currentTime = Date.now();
    const uploadWindow = 60 * 60 * 1000; // 1 hour window
    
    if (!req.uploadCounts) req.uploadCounts = new Map();
    
    const userUploads = req.uploadCounts.get(uploadKey) || { count: 0, resetTime: currentTime + uploadWindow };
    
    if (currentTime > userUploads.resetTime) {
      userUploads.count = 0;
      userUploads.resetTime = currentTime + uploadWindow;
    }
    
    if (userUploads.count >= 10) { // Max 10 uploads per hour per user
      return res.status(429).json({ error: 'Upload limit exceeded. Please try again later.' });
    }
    
    userUploads.count++;
    req.uploadCounts.set(uploadKey, userUploads);
    
    next();
  };

  // Statement parsing endpoint with enhanced security
  app.post('/api/statements/parse', 
    authMiddleware, 
    validateFileUpload,
    upload.single('statement'), 
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        // Additional security checks
        const file = req.file;
        
        // Validate file buffer
        if (!file.buffer || file.buffer.length === 0) {
          return res.status(400).json({ error: 'Invalid file content' });
        }

        // Log upload attempt for security monitoring
        console.log(`[SECURITY] File upload attempt - User: ${req.user._id}, File: ${file.originalname}, Size: ${file.size} bytes, Type: ${file.mimetype}`);
        
        let result;
        
        // Get reverse logic preference
        const reverseLogic = req.body.reverseLogic === 'true';
        
        // Parse based on file type
        if (file.mimetype === 'text/csv' || file.mimetype === 'application/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
          // Parse CSV file
          result = await CSVParser.parseCSVStatement(file.buffer, reverseLogic);
        } else if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet') || 
                   file.originalname.toLowerCase().endsWith('.xlsx') || file.originalname.toLowerCase().endsWith('.xls')) {
          // Parse Excel file
          result = await ExcelParser.parseExcelStatement(file.buffer, reverseLogic);
        } else {
          return res.status(400).json({ error: 'Unsupported file type. Please upload CSV or Excel files.' });
        }
        
        res.json(result);
      } catch (error) {
        console.error('Statement parsing error:', error);
        res.status(500).json({ error: 'Failed to parse statement' });
      }
    }
  );

  // Statement import endpoint
  app.post('/api/statements/import', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { accountId, transactions } = req.body;
      const userId = req.user!._id;

      if (!accountId || !transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Invalid request data' });
      }

      // Verify account belongs to user
      const account = await storage.getAccount(accountId);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ error: 'Account not found' });
      }

      let importedCount = 0;
      const errors: string[] = [];

      for (const transaction of transactions) {
        try {
          await storage.createTransaction({
            amount: transaction.amount.toString(),
            description: transaction.description,
            type: transaction.type,
            date: transaction.date,
            accountId: transaction.accountId || accountId,
            categoryId: transaction.categoryId,
          });
          importedCount++;
        } catch (error) {
          errors.push(`Failed to import transaction "${transaction.description}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        importedCount,
        errors,
        message: `Successfully imported ${importedCount} transactions`,
      });
    } catch (error) {
      console.error('Statement import error:', error);
      res.status(500).json({ error: 'Failed to import transactions' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

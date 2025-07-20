import mongoose from 'mongoose';
import { z } from "zod";

// MongoDB Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, { timestamps: true });

const AccountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // checking, savings, credit
  balance: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isArchived: { type: Boolean, default: false },
}, { timestamps: true });

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, required: true },
  icon: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isArchived: { type: Boolean, default: false },
}, { timestamps: true });

const TransactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  type: { type: String, required: true }, // income, expense
  date: { type: Date, required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  isArchived: { type: Boolean, default: false },
}, { timestamps: true });

// Mongoose Models
export const UserModel = mongoose.model('User', UserSchema);
export const AccountModel = mongoose.model('Account', AccountSchema);
export const CategoryModel = mongoose.model('Category', CategorySchema);
export const TransactionModel = mongoose.model('Transaction', TransactionSchema);

// Zod validation schemas
export const registerUserSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(6),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const insertAccountSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  balance: z.string().regex(/^\d+(\.\d{2})?$/, "Balance must be a valid decimal with 2 decimal places"),
});

export const insertCategorySchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  icon: z.string().min(1),
});

export const insertTransactionSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{2})?$/, "Amount must be a valid decimal with 2 decimal places"),
  description: z.string().min(1),
  type: z.string().min(1),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid date format"),
  accountId: z.string(),
  categoryId: z.string(),
});

export const transferSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{2})?$/, "Amount must be a valid decimal with 2 decimal places"),
  description: z.string().min(1),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid date format"),
  fromAccountId: z.string(),
  toAccountId: z.string(),
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: "Source and destination accounts must be different",
  path: ["toAccountId"],
});

// Additional validation schemas for server-side operations
export const updateProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  email: z.string().email().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const updateAccountSchema = insertAccountSchema.partial();

export const updateCategorySchema = insertCategorySchema.partial();

export const updateTransactionSchema = insertTransactionSchema.partial();

// Query parameter validation schemas
export const transactionFiltersSchema = z.object({
  search: z.string().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  type: z.string().optional(),
  transactionKind: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amountMin: z.string().optional(),
  amountMax: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// TypeScript types
export interface User {
  _id: string;
  username: string;
  email: string;
  password: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  _id: string;
  name: string;
  type: string;
  balance: number;
  userId: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  _id: string;
  name: string;
  color: string;
  icon: string;
  userId: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  _id: string;
  amount: number;
  description: string;
  type: string;
  date: Date;
  accountId: string;
  categoryId: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type RegisterUser = z.infer<typeof registerUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transfer = z.infer<typeof transferSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type Pagination = z.infer<typeof paginationSchema>;

export interface TransactionWithDetails extends Transaction {
  account: Account;
  category: Category;
}
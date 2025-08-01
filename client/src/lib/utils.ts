import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TransactionWithDetails, Account } from "@shared/schema"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: string | number): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numAmount);
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateFull(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getAccountTypeIcon(type: string): string {
  switch (type) {
    case "checking":
      return "fas fa-university";
    case "savings":
      return "fas fa-piggy-bank";
    case "credit":
      return "fas fa-credit-card";
    case "investment":
      return "fas fa-chart-line";
    default:
      return "fas fa-wallet";
  }
}

export function getAccountTypeColor(type: string): string {
  switch (type) {
    case "checking":
      return "bg-blue-500";
    case "savings":
      return "bg-green-500";
    case "credit":
      return "bg-red-500";
    case "investment":
      return "bg-purple-500";
    default:
      return "bg-gray-500";
  }
}

export function getTransactionTypeColor(type: string): string {
  switch (type) {
    case "income":
      return "text-green-600";
    case "expense":
      return "text-red-600";
    default:
      return "text-foreground";
  }
}

export function highlightTransactionPrefix(description: string): { prefix: string; rest: string; hasPrefix: boolean; color: string } {
  // Common transaction prefixes to highlight with their colors
  const prefixConfigs = [
    { prefix: 'PURCHASE AT', color: 'bg-red-100 text-red-800' },
    { prefix: 'PAYMENT TO', color: 'bg-red-100 text-red-800' },
    { prefix: 'FUNDS TRANSFERRED TO', color: 'bg-purple-100 text-purple-800' },
    { prefix: 'PAYMENT FROM', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'FUNDS RECEIVED FROM', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'TRANSFER:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'TRANSFER', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'PAYMENT:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'DEPOSIT:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'WITHDRAWAL:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'PURCHASE:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'REFUND:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'FEE:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'CHARGE:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'CREDIT:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'DEBIT:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'ATM:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'POS:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'ONLINE:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'IN-STORE:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'RECURRING:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'AUTOPAY:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'BILL PAY:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'DIRECT DEPOSIT:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'ACH:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'WIRE:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'CHECK:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'CASH:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'VENMO:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'PAYPAL:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'ZELLE:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'CASH APP:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'APPLE PAY:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'GOOGLE PAY:', color: 'bg-blue-100 text-blue-800' },
    { prefix: 'SAMSUNG PAY:', color: 'bg-blue-100 text-blue-800' }
  ];

  // Find the longest matching prefix
  let matchedConfig = null;
  for (const config of prefixConfigs) {
    if (description.toUpperCase().startsWith(config.prefix.toUpperCase())) {
      if (!matchedConfig || config.prefix.length > matchedConfig.prefix.length) {
        matchedConfig = config;
      }
    }
  }

  if (matchedConfig) {
    const prefixLength = matchedConfig.prefix.length;
    const prefix = description.substring(0, prefixLength);
    const rest = description.substring(prefixLength);
    
    return {
      prefix,
      rest,
      hasPrefix: true,
      color: matchedConfig.color
    };
  }

  return {
    prefix: '',
    rest: description,
    hasPrefix: false,
    color: 'bg-blue-100 text-blue-800'
  };
}

// Transfer-related types and utilities
export interface TransactionOrTransfer extends Omit<TransactionWithDetails, 'type'> {
  type: 'income' | 'expense' | 'transfer';
  isTransfer?: boolean;
  fromAccount?: {
    _id: string;
    name: string;
  };
  toAccount?: {
    _id: string;
    name: string;
  };
  fromTransactionId?: string;
  toTransactionId?: string;
}

export interface GroupedTransfer extends TransactionOrTransfer {
  type: 'transfer';
  isTransfer: true;
  fromAccount: {
    _id: string;
    name: string;
  };
  toAccount: {
    _id: string;
    name: string;
  };
  fromTransactionId: string;
  toTransactionId: string;
}

export function isTransferTransaction(transaction: TransactionWithDetails): boolean {
  return transaction.category.name === 'Transfer' && 
         (transaction.description.startsWith('Transfer to ') || 
          transaction.description.startsWith('Transfer from '));
}

export function extractTransferInfo(description: string): { direction: 'to' | 'from', accountName: string, userDescription: string } | null {
  const toMatch = description.match(/^Transfer to ([^:]+): (.+)$/);
  if (toMatch) {
    return { direction: 'to', accountName: toMatch[1], userDescription: toMatch[2] };
  }
  
  const fromMatch = description.match(/^Transfer from ([^:]+): (.+)$/);
  if (fromMatch) {
    return { direction: 'from', accountName: fromMatch[1], userDescription: fromMatch[2] };
  }
  
  return null;
}

export function groupTransferTransactions(transactions: TransactionWithDetails[]): TransactionOrTransfer[] {
  // Safety check for null/undefined
  if (!transactions || !Array.isArray(transactions)) {
    return [];
  }
  
  const transferPairs = new Map<string, {
    fromTransaction?: TransactionWithDetails;
    toTransaction?: TransactionWithDetails;
  }>();
  
  const regularTransactions: TransactionOrTransfer[] = [];
  
  // Group transfers by description and date
  for (const transaction of transactions) {
    if (!isTransferTransaction(transaction)) {
      regularTransactions.push({
        ...transaction,
        type: transaction.type as 'income' | 'expense'
      });
      continue;
    }
    
    const transferInfo = extractTransferInfo(transaction.description);
    if (!transferInfo) {
      // Fallback for malformed transfer descriptions
      regularTransactions.push({
        ...transaction,
        type: transaction.type as 'income' | 'expense'
      });
      continue;
    }
    
    // Create a unique key for matching transfer pairs
    const dateKey = new Date(transaction.date).toISOString().split('T')[0];
    const key = `${transferInfo.userDescription}-${dateKey}-${transaction.amount}`;
    
    if (!transferPairs.has(key)) {
      transferPairs.set(key, {});
    }
    
    const pair = transferPairs.get(key)!;
    
    if (transferInfo.direction === 'to' && transaction.type === 'expense') {
      pair.fromTransaction = transaction;
    } else if (transferInfo.direction === 'from' && transaction.type === 'income') {
      pair.toTransaction = transaction;
    }
  }
  
  // Convert transfer pairs to grouped transfers
  const groupedTransfers: GroupedTransfer[] = [];
  
  for (const [key, pair] of transferPairs) {
    if (pair.fromTransaction && pair.toTransaction) {
      // We have both sides of the transfer
      const transferInfo = extractTransferInfo(pair.fromTransaction.description);
      if (transferInfo) {
        groupedTransfers.push({
          _id: `transfer-${pair.fromTransaction._id}-${pair.toTransaction._id}`,
          amount: pair.fromTransaction.amount,
          description: transferInfo.userDescription,
          date: pair.fromTransaction.date,
          account: pair.fromTransaction.account,
          accountId: pair.fromTransaction.accountId,
          category: pair.fromTransaction.category,
          categoryId: pair.fromTransaction.categoryId,
          isArchived: pair.fromTransaction.isArchived,
          createdAt: pair.fromTransaction.createdAt,
          updatedAt: pair.fromTransaction.updatedAt,
          fromAccount: {
            _id: pair.fromTransaction.account._id,
            name: pair.fromTransaction.account.name
          },
          toAccount: {
            _id: pair.toTransaction.account._id,
            name: pair.toTransaction.account.name
          },
          type: 'transfer',
          isTransfer: true,
          fromTransactionId: pair.fromTransaction._id,
          toTransactionId: pair.toTransaction._id
        });
      }
    } else if (pair.fromTransaction) {
      // Only have the 'from' side - treat as regular transaction
      regularTransactions.push({
        ...pair.fromTransaction,
        type: pair.fromTransaction.type as 'income' | 'expense'
      });
    } else if (pair.toTransaction) {
      // Only have the 'to' side - treat as regular transaction
      regularTransactions.push({
        ...pair.toTransaction,
        type: pair.toTransaction.type as 'income' | 'expense'
      });
    }
  }
  
  // Combine and sort by date
  const allTransactions: TransactionOrTransfer[] = [
    ...regularTransactions,
    ...groupedTransfers
  ];
  
  return allTransactions.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export interface AccountFinancialSummary {
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  netChange: number;
  currentBalance: number;
}

export function calculateAccountFinancialSummary(
  account: Account,
  transactions: TransactionWithDetails[]
): AccountFinancialSummary {
  const initialBalance = account.balance || 0;
  
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const netChange = totalIncome - totalExpense;
  const currentBalance = initialBalance + netChange;
  
  return {
    initialBalance,
    totalIncome,
    totalExpense,
    netChange,
    currentBalance
  };
}

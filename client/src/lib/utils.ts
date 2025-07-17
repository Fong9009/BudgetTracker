import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isToday(dateObj)) {
    return 'Today';
  }
  
  if (isYesterday(dateObj)) {
    return 'Yesterday';
  }
  
  const daysDiff = Math.abs(Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff < 7) {
    return formatDistanceToNow(dateObj, { addSuffix: true });
  }
  
  return format(dateObj, 'MMM d');
}

export function formatDateFull(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MMM d, yyyy');
}

export function safeFormatCurrency(amount: string | number | undefined | null): string {
  if (amount === undefined || amount === null) {
    return formatCurrency(0);
  }
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return formatCurrency(0);
  }
  return formatCurrency(num);
}

export function getAccountTypeIcon(type: string): string {
  switch (type.toLowerCase()) {
    case 'checking':
      return 'fas fa-university';
    case 'savings':
      return 'fas fa-piggy-bank';
    case 'credit':
      return 'fas fa-credit-card';
    default:
      return 'fas fa-wallet';
  }
}

export function getAccountTypeColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'checking':
      return 'bg-blue-500';
    case 'savings':
      return 'bg-green-500';
    case 'credit':
      return 'bg-purple-500';
    default:
      return 'bg-gray-500';
  }
}

export function getTransactionTypeColor(type: string): string {
  return type === 'income' ? 'text-green-600' : 'text-red-600';
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

import * as XLSX from 'xlsx';
import { ParsedTransaction, StatementParseResult } from './types';

export class ExcelParser {
  private static headerLine: string = '';

  private static getHeaderLine(): string {
    return this.headerLine;
  }

  static async parseExcelStatement(excelBuffer: Buffer, reverseLogic: boolean = false): Promise<StatementParseResult> {
    const result: StatementParseResult = {
      transactions: [],
      errors: [],
    };

    try {
      // Read the Excel file
      const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
      
      if (workbook.SheetNames.length === 0) {
        result.errors.push('Excel file appears to be empty');
        return result;
      }

      // Try to find the sheet with transaction data
      const sheetName = this.findTransactionSheet(workbook);
      if (!sheetName) {
        result.errors.push('Could not find a sheet with transaction data');
        return result;
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        result.errors.push('Excel file has no data rows');
        return result;
      }

      // Convert to string format for processing
      const csvText = this.convertToCSV(jsonData);
      const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

      // Store the header line for reference
      this.headerLine = lines[0];

      // Use the same parsing logic as CSV
      const format = this.detectFormat(lines);
  

      const transactions = this.parseTransactionsByFormat(lines, format, reverseLogic);
      result.transactions = this.deduplicateAndSortTransactions(transactions);
      
      // Extract account information if available
      result.accountNumber = this.extractAccountNumber(csvText);
      result.statementPeriod = this.extractStatementPeriod(csvText);

    } catch (error) {
      console.error('Excel parsing error:', error);
      result.errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private static findTransactionSheet(workbook: XLSX.WorkBook): string | null {
    // Look for common sheet names that might contain transactions
    const transactionKeywords = ['transaction', 'statement', 'activity', 'history', 'data'];
    
    for (const sheetName of workbook.SheetNames) {
      const lowerSheetName = sheetName.toLowerCase();
      if (transactionKeywords.some(keyword => lowerSheetName.includes(keyword))) {
        return sheetName;
      }
    }

    // If no obvious sheet name, try the first sheet with data
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length > 1) {
        return sheetName;
      }
    }

    return null;
  }

  private static convertToCSV(jsonData: any[][]): string {
    return jsonData.map(row => 
      row.map(cell => {
        // Handle different cell types
        if (cell === null || cell === undefined) {
          return '';
        }
        if (typeof cell === 'object' && cell.t) {
          // XLSX cell object
          return cell.v || '';
        }
        // Convert to string and escape quotes
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');
  }

  private static detectFormat(lines: string[]): 'standard' | 'bank' | 'custom' | 'separate_columns' {
    const header = lines[0].toLowerCase();
    
    // Check for separate Money In/Money Out columns
    if (header.includes('money in') && header.includes('money out')) {
      return 'separate_columns';
    }
    
    if (header.includes('credit') && header.includes('debit')) {
      return 'separate_columns';
    }
    
    if (header.includes('deposit') && header.includes('withdrawal')) {
      return 'separate_columns';
    }
    
    // Common bank Excel formats
    if (header.includes('date') && header.includes('description') && header.includes('amount')) {
      return 'standard';
    }
    
    if (header.includes('transaction date') && header.includes('description') && header.includes('amount')) {
      return 'bank';
    }
    
    if (header.includes('posted date') && header.includes('description') && header.includes('amount')) {
      return 'bank';
    }
    
    // Default to custom format
    return 'custom';
  }

  private static parseTransactionsByFormat(lines: string[], format: string, reverseLogic: boolean): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const transaction = this.parseLine(line, format, reverseLogic);
      if (transaction) {
        transactions.push(transaction);
      }
    }
    
    return transactions;
  }

  private static parseLine(line: string, format: string, reverseLogic: boolean): ParsedTransaction | null {
    try {
      // Parse CSV line (handle quoted fields)
      const fields = this.parseCSVFields(line);
      
      if (fields.length < 3) {
        return null;
      }

      let date: Date | null = null;
      let description: string = '';
      let amount: number = 0;
      let type: 'income' | 'expense' = 'expense';

      if (format === 'separate_columns') {
        // Format with separate Money In/Money Out columns
        date = this.parseDate(fields[0]);
        description = fields[1] || '';
        
        // Look for Money In and Money Out columns
        const header = this.getHeaderLine();
        const headerFields = this.parseCSVFields(header);
        
        let moneyInIndex = -1;
        let moneyOutIndex = -1;
        
        for (let i = 0; i < headerFields.length; i++) {
          const headerField = headerFields[i].toLowerCase();
          if (headerField.includes('money in') || headerField.includes('credit') || headerField.includes('deposit')) {
            moneyInIndex = i;
          }
          if (headerField.includes('money out') || headerField.includes('debit') || headerField.includes('withdrawal')) {
            moneyOutIndex = i;
          }
        }
        
        // Parse amounts from separate columns
        const moneyIn = moneyInIndex >= 0 ? this.parseAmount(fields[moneyInIndex] || '0') : 0;
        const moneyOut = moneyOutIndex >= 0 ? this.parseAmount(fields[moneyOutIndex] || '0') : 0;
        
        if (moneyIn > 0) {
          amount = moneyIn;
          type = 'income';
        } else if (moneyOut > 0) {
          amount = moneyOut;
          type = 'expense';
        } else {
          return null; // No transaction
        }
        
      } else if (format === 'standard' || format === 'bank') {
        // Standard format: Date, Description, Amount
        date = this.parseDate(fields[0]);
        description = fields[1] || fields[2] || '';
        amount = this.parseAmount(fields[2] || fields[3] || '0');
        
        // For most bank statements: negative = expense, positive = income
        // But some banks do the opposite, so we'll use reverseLogic parameter
        if (reverseLogic) {
          // Reversed logic: positive = expense, negative = income
          if (amount > 0) {
            type = 'expense';
          } else {
            type = 'income';
            amount = Math.abs(amount);
          }
        } else {
          // Standard logic: positive = income, negative = expense
          if (amount > 0) {
            type = 'income';
          } else {
            type = 'expense';
            amount = Math.abs(amount);
          }
        }
      } else {
        // Custom format - try to detect fields
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          
          // Try to parse as date
          if (!date) {
            date = this.parseDate(field);
            if (date) continue;
          }
          
          // Try to parse as amount
          if (amount === 0) {
            const parsedAmount = this.parseAmount(field);
            if (parsedAmount !== 0) {
              amount = parsedAmount;
              if (reverseLogic) {
                // Reversed logic: positive = expense, negative = income
                if (amount > 0) {
                  type = 'expense';
                } else {
                  type = 'income';
                  amount = Math.abs(amount);
                }
              } else {
                // Standard logic: positive = income, negative = expense
                if (amount > 0) {
                  type = 'income';
                } else {
                  type = 'expense';
                  amount = Math.abs(amount);
                }
              }
              continue;
            }
          }
          
          // Use as description if not empty
          if (!description && field.trim().length > 0) {
            description = field;
          }
        }
      }

      if (!date || !description || amount === 0) {
        return null;
      }

      return {
        date,
        description: description.trim(),
        amount,
        type,
        rawText: line,
      };

    } catch (error) {
      console.warn('Failed to parse Excel line:', line, error);
      return null;
    }
  }

  private static parseCSVFields(line: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    
    // Add the last field
    fields.push(currentField.trim());
    
    return fields;
  }

  private static parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.trim().length === 0) {
      return null;
    }

    // Handle Excel date numbers (days since 1900-01-01)
    if (!isNaN(Number(dateStr)) && Number(dateStr) > 1) {
      const excelDate = Number(dateStr);
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try various date formats
    const dateFormats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // MM/DD/YYYY or MM/DD/YY
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/,   // MM-DD-YYYY or MM-DD-YY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,     // YYYY-MM-DD
    ];

    for (const format of dateFormats) {
      const match = dateStr.match(format);
      if (match) {
        const [, first, second, third] = match;
        const firstNum = parseInt(first, 10);
        const secondNum = parseInt(second, 10);
        const thirdNum = parseInt(third, 10);
        
        if (thirdNum > 1000) {
          // YYYY-MM-DD format
          return new Date(thirdNum, secondNum - 1, firstNum);
        } else if (thirdNum > 50) {
          // MM/DD/YY format (assuming 20xx for years 50-99)
          return new Date(2000 + thirdNum, firstNum - 1, secondNum);
        } else {
          // MM/DD/YY format (assuming 20xx for years 0-49)
          return new Date(2000 + thirdNum, firstNum - 1, secondNum);
        }
      }
    }

    // Try direct Date parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  }

  private static parseAmount(amountStr: string): number {
    if (!amountStr || amountStr.trim().length === 0) {
      return 0;
    }

    // Remove currency symbols and commas
    const cleanAmount = amountStr.replace(/[\$,£€¥]/g, '').replace(/,/g, '');
    
    // Parse as float
    const amount = parseFloat(cleanAmount);
    return isNaN(amount) ? 0 : amount;
  }

  private static deduplicateAndSortTransactions(transactions: ParsedTransaction[]): ParsedTransaction[] {
    const unique = new Map<string, ParsedTransaction>();
    
    for (const transaction of transactions) {
      const key = `${transaction.date.toISOString().split('T')[0]}-${transaction.description}-${transaction.amount}`;
      if (!unique.has(key)) {
        unique.set(key, transaction);
      }
    }

    return Array.from(unique.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private static extractAccountNumber(text: string): string | undefined {
    // Look for common account number patterns
    const patterns = [
      /ACCOUNT[:\s]*(\d{4}[-*]\d{4}[-*]\d{4}[-*]\d{4})/i,
      /ACCT[:\s]*(\d{4}[-*]\d{4}[-*]\d{4}[-*]\d{4})/i,
      /ACCOUNT[:\s]*(\d{10,16})/i,
      /ACCT[:\s]*(\d{10,16})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  private static extractStatementPeriod(text: string): { from: Date; to: Date } | undefined {
    // Look for statement period patterns
    const patterns = [
      /STATEMENT PERIOD[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /PERIOD[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const fromDate = this.parseDate(match[1]);
        const toDate = this.parseDate(match[2]);
        if (fromDate && toDate) {
          return { from: fromDate, to: toDate };
        }
      }
    }

    return undefined;
  }
} 
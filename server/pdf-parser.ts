import { ParsedTransaction, StatementParseResult } from './types';

export class PDFParser {
  private static headerLine: string = '';

  static getHeaderLine(): string {
    return this.headerLine;
  }

  static async parsePDFStatement(pdfBuffer: Buffer): Promise<StatementParseResult> {
    const result: StatementParseResult = {
      transactions: [],
      errors: [],
    };

    try {
      // Use dynamic import for ES modules compatibility
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = pdfParseModule.default || pdfParseModule;
      
      const data = await pdfParse(pdfBuffer);
      const text = data.text;
      
      if (text && text.trim().length > 0) {
        const transactions = this.parseTransactionsFromText(text);
        result.transactions = this.deduplicateAndSortTransactions(transactions);
        result.accountNumber = this.extractAccountNumber(text);
        result.statementPeriod = this.extractStatementPeriod(text);
      } else {
        result.errors.push('No text content found in PDF. The PDF might be image-based or corrupted.');
      }

    } catch (error) {
      console.error('PDF parsing error:', error);
      result.errors.push(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private static parseTransactionsFromText(text: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (const line of lines) {
      const transaction = this.parseTransactionLine(line);
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  private static parseTransactionLine(line: string): ParsedTransaction | null {
    // Look for date patterns
    let date: Date | null = null;
    let dateMatch: RegExpMatchArray | null = null;

    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, // MM/DD/YYYY or MM/DD/YY
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/g,   // MM-DD-YYYY or MM-DD-YY
      /(\d{4})-(\d{1,2})-(\d{1,2})/g,     // YYYY-MM-DD
    ];

    for (const pattern of datePatterns) {
      dateMatch = line.match(pattern);
      if (dateMatch) {
        date = this.parseDate(dateMatch);
        break;
      }
    }

    if (!date) return null;

    // Look for amount patterns
    let amount: number | null = null;
    let amountMatch: RegExpMatchArray | null = null;

    const amountPatterns = [
      /[\$]?([\d,]+\.\d{2})/g,            // $1,234.56 or 1,234.56
      /[\$]?([\d]+\.\d{2})/g,             // $1234.56 or 1234.56
    ];

    for (const pattern of amountPatterns) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const parsedAmount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(parsedAmount) && parsedAmount > 0) {
          amount = parsedAmount;
          amountMatch = match;
          break;
        }
      }
      if (amount) break;
    }

    if (!amount) return null;

    // Extract description
    const description = this.extractDescription(line, dateMatch, amountMatch);
    if (!description) return null;

    // Determine transaction type
    const type = this.determineTransactionType(description, amount);

    return {
      date,
      description: description.trim(),
      amount,
      type,
      rawText: line,
    };
  }

  private static parseDate(match: RegExpMatchArray): Date {
    const [fullMatch, ...groups] = match;
    
    if (groups.length === 3) {
      const [first, second, third] = groups.map(g => parseInt(g, 10));
      
      // Handle different date formats
      if (third > 1000) {
        // YYYY-MM-DD format
        return new Date(third, second - 1, first);
      } else if (third > 50) {
        // MM/DD/YY format (assuming 20xx for years 50-99)
        return new Date(2000 + third, first - 1, second);
      } else {
        // MM/DD/YY format (assuming 20xx for years 0-49)
        return new Date(2000 + third, first - 1, second);
      }
    }
    
    // Fallback to current date
    return new Date();
  }

  private static extractDescription(
    line: string, 
    dateMatch: RegExpMatchArray | null, 
    amountMatch: RegExpMatchArray | null
  ): string | null {
    let description = line;

    // Remove date
    if (dateMatch) {
      description = description.replace(dateMatch[0], '').trim();
    }

    // Remove amount
    if (amountMatch) {
      description = description.replace(amountMatch[0], '').trim();
    }

    // Clean up extra whitespace and common artifacts
    description = description.replace(/\s+/g, ' ').trim();

    // Filter out very short descriptions or common artifacts
    if (description.length < 3 || this.isCommonArtifact(description)) {
      return null;
    }

    return description;
  }

  private static isCommonArtifact(text: string): boolean {
    const artifacts = [
      'BALANCE',
      'TOTAL',
      'SUMMARY',
      'PAGE',
      'OF',
      'ACCOUNT',
      'STATEMENT',
      'PERIOD',
      'FROM',
      'TO',
      'DATE',
      'DESCRIPTION',
      'AMOUNT',
      'DEBIT',
      'CREDIT',
    ];

    return artifacts.some(artifact => 
      text.toUpperCase().includes(artifact) && text.length < 20
    );
  }

  private static determineTransactionType(description: string, amount: number): 'income' | 'expense' {
    const upperDesc = description.toUpperCase();
    
    // Keywords that typically indicate income
    const incomeKeywords = [
      'DEPOSIT',
      'CREDIT',
      'REFUND',
      'INTEREST',
      'DIVIDEND',
      'PAYMENT RECEIVED',
      'TRANSFER IN',
      'CASH BACK',
      'REBATE',
      'FUNDS RECEIVED',
      'PAYMENT FROM',
    ];

    // Keywords that typically indicate expenses
    const expenseKeywords = [
      'WITHDRAWAL',
      'DEBIT',
      'PURCHASE',
      'PAYMENT',
      'FEE',
      'CHARGE',
      'TRANSFER OUT',
      'ATM',
      'POS',
      'PURCHASE AT',
      'PAYMENT TO',
      'FUNDS TRANSFERRED',
    ];

    // Check for income keywords
    if (incomeKeywords.some(keyword => upperDesc.includes(keyword))) {
      return 'income';
    }

    // Check for expense keywords
    if (expenseKeywords.some(keyword => upperDesc.includes(keyword))) {
      return 'expense';
    }

    // Default to expense for unknown transactions
    return 'expense';
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
        const fromDate = this.parseDate(match);
        const toDate = this.parseDate(match);
        return { from: fromDate, to: toDate };
      }
    }

    return undefined;
  }
} 
import { ParsedTransaction, StatementParseResult } from './types';

export class EnhancedPDFParser {
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
      // Try multiple parsing strategies
      const strategies = [
        this.parseWithPDFParse,
        this.parseWithPDFJS,
        this.parseWithOCR
      ];

      for (const strategy of strategies) {
        try {
          const parsedResult = await strategy(pdfBuffer);
          if (parsedResult.transactions.length > 0) {
            console.log(`PDF parsed successfully using ${strategy.name}`);
            return {
              ...parsedResult,
              accountNumber: parsedResult.accountNumber || this.extractAccountNumber(parsedResult.transactions),
              statementPeriod: parsedResult.statementPeriod || this.extractStatementPeriod(parsedResult.transactions)
            };
          }
        } catch (error) {
          console.log(`Strategy ${strategy.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
          continue;
        }
      }

      result.errors.push('All parsing strategies failed. The PDF might be corrupted or in an unsupported format.');
    } catch (error) {
      console.error('Enhanced PDF parsing error:', error);
      result.errors.push(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private static async parseWithPDFParse(pdfBuffer: Buffer): Promise<StatementParseResult> {
    const result: StatementParseResult = {
      transactions: [],
      errors: [],
    };

    try {
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = pdfParseModule.default || pdfParseModule;
      
      const data = await pdfParse(pdfBuffer);
      
      const text = data.text;
      
      if (text && text.trim().length > 0) {
        const transactions = this.parseTransactionsFromText(text);
        result.transactions = this.deduplicateAndSortTransactions(transactions);
      } else {
        throw new Error('No text content found');
      }
    } catch (error) {
      throw new Error(`PDF-parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private static async parseWithPDFJS(pdfBuffer: Buffer): Promise<StatementParseResult> {
    const result: StatementParseResult = {
      transactions: [],
      errors: [],
    };

    try {
      // This would require pdfjs-dist setup
      // For now, we'll skip this strategy
      throw new Error('PDF.js strategy not implemented yet');
    } catch (error) {
      throw new Error(`PDF.js failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async parseWithOCR(pdfBuffer: Buffer): Promise<StatementParseResult> {
    const result: StatementParseResult = {
      transactions: [],
      errors: [],
    };

    try {
      // This would require tesseract-ocr setup
      // For now, we'll skip this strategy
      throw new Error('OCR strategy not implemented yet');
    } catch (error) {
      throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static parseTransactionsFromText(text: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Try different parsing patterns
    const patterns = [
      this.parseStandardFormat,
      this.parseTableFormat,
      this.parseCSVLikeFormat
    ];

    for (const pattern of patterns) {
      const parsed = pattern(lines);
      if (parsed.length > 0) {
        console.log(`Found ${parsed.length} transactions using ${pattern.name}`);
        return parsed;
      }
    }

    return transactions;
  }

  private static parseStandardFormat(lines: string[]): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    for (const line of lines) {
      const transaction = this.parseTransactionLine(line);
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  private static parseTableFormat(lines: string[]): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    let headerFound = false;
    let dateColumn = -1;
    let descriptionColumn = -1;
    let amountColumn = -1;

    for (const line of lines) {
      if (!headerFound) {
        // Look for header row
        const columns = line.split(/\s{2,}/);
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i].toLowerCase();
          if (col.includes('date')) dateColumn = i;
          if (col.includes('desc') || col.includes('detail')) descriptionColumn = i;
          if (col.includes('amount') || col.includes('debit') || col.includes('credit')) amountColumn = i;
        }
        
        if (dateColumn >= 0 && descriptionColumn >= 0 && amountColumn >= 0) {
          headerFound = true;
        }
        continue;
      }

      // Parse data rows
      const columns = line.split(/\s{2,}/);
      if (columns.length >= Math.max(dateColumn, descriptionColumn, amountColumn) + 1) {
        const date = this.parseDateFromString(columns[dateColumn]);
        const description = columns[descriptionColumn];
        const amount = this.parseAmountFromString(columns[amountColumn]);

        if (date && description && amount !== null) {
          const type = this.determineTransactionType(description, amount);
          transactions.push({
            date,
            description: description.trim(),
            amount: Math.abs(amount),
            type,
            rawText: line,
          });
        }
      }
    }

    return transactions;
  }

  private static parseCSVLikeFormat(lines: string[]): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    for (const line of lines) {
      // Try comma-separated format
      const columns = line.split(',').map(col => col.trim());
      if (columns.length >= 3) {
        const date = this.parseDateFromString(columns[0]);
        const description = columns[1];
        const amount = this.parseAmountFromString(columns[2]);

        if (date && description && amount !== null) {
          const type = this.determineTransactionType(description, amount);
          transactions.push({
            date,
            description: description.trim(),
            amount: Math.abs(amount),
            type,
            rawText: line,
          });
        }
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

  private static parseDateFromString(dateStr: string): Date | null {
    // Try various date formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // MM/DD/YYYY
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/,   // MM-DD-YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,     // YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        return this.parseDate(match);
      }
    }

    return null;
  }

  private static parseAmountFromString(amountStr: string): number | null {
    // Remove currency symbols and commas
    const cleanAmount = amountStr.replace(/[\$,]/g, '');
    const amount = parseFloat(cleanAmount);
    return isNaN(amount) ? null : amount;
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

  private static extractAccountNumber(transactions: ParsedTransaction[]): string | undefined {
    // Look for account number patterns in transaction descriptions
    const patterns = [
      /ACCOUNT[:\s]*(\d{4}[-*]\d{4}[-*]\d{4}[-*]\d{4})/i,
      /ACCT[:\s]*(\d{4}[-*]\d{4}[-*]\d{4}[-*]\d{4})/i,
      /ACCOUNT[:\s]*(\d{10,16})/i,
      /ACCT[:\s]*(\d{10,16})/i,
    ];

    for (const transaction of transactions) {
      for (const pattern of patterns) {
        const match = transaction.rawText.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }

    return undefined;
  }

  private static extractStatementPeriod(transactions: ParsedTransaction[]): { from: Date; to: Date } | undefined {
    if (transactions.length === 0) return undefined;

    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
    return {
      from: dates[0],
      to: dates[dates.length - 1]
    };
  }
} 
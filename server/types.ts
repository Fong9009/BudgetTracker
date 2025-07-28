export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  rawText: string;
}

export interface StatementParseResult {
  transactions: ParsedTransaction[];
  accountNumber?: string;
  statementPeriod?: {
    from: Date;
    to: Date;
  };
  errors: string[];
} 
import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { formatCurrency, formatDateFull } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { getValidToken } from "@/lib/queryClient";
import type { Account, Category } from "@shared/schema";

interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  rawText: string;
}

interface StatementParseResult {
  transactions: ParsedTransaction[];
  accountNumber?: string;
  statementPeriod?: {
    from: Date;
    to: Date;
  };
  errors: string[];
}

interface UploadStatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadStatementModal({ open, onOpenChange }: UploadStatementModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [categoryMappings, setCategoryMappings] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch accounts and categories
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    enabled: open,
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) return [];
      
      const response = await fetch("/api/accounts", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: open,
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) return [];
      
      const response = await fetch("/api/categories", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Parse statement mutation
  const parseStatementMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('statement', file);
      
      const token = await getValidToken();
      if (!token) throw new Error("No valid token");
      
      const response = await fetch("/api/statements/parse", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      return response.json() as Promise<StatementParseResult>;
    },
    onSuccess: (result) => {
      setParseResult(result);
      // Auto-select all transactions
      const allIndices = new Set(result.transactions.map((_, index) => index));
      setSelectedTransactions(allIndices);
      
      // Auto-map categories based on description keywords
      const mappings = new Map<string, string>();
      result.transactions.forEach(transaction => {
        const category = findBestCategoryMatch(transaction.description, categories);
        if (category) {
          mappings.set(transaction.description, category._id);
        }
      });
      setCategoryMappings(mappings);
      
      toast({
        title: "Statement parsed successfully",
        description: `Found ${result.transactions.length} transactions`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to parse statement",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Import transactions mutation
  const importTransactionsMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult || !selectedAccount) throw new Error("Missing required data");
      
      const selectedTransactionsList = parseResult.transactions.filter((_, index) => 
        selectedTransactions.has(index)
      );
      
      const token = await getValidToken();
      if (!token) throw new Error("No valid token");
      
      const response = await fetch("/api/statements/import", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: selectedAccount,
          transactions: selectedTransactionsList.map(tx => ({
            ...tx,
            categoryId: categoryMappings.get(tx.description) || categories[0]?._id,
          })),
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Transactions imported successfully",
        description: `Imported ${result.importedCount} transactions`,
      });
      
      // Reset form
      setFile(null);
      setParseResult(null);
      setSelectedTransactions(new Set());
      setCategoryMappings(new Map());
      setSelectedAccount("");
      
      // Refresh transactions list
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      // Close modal
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to import transactions",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setParseResult(null);
      setSelectedTransactions(new Set());
      setCategoryMappings(new Map());
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleParseStatement = useCallback(() => {
    if (!file) return;
    
    setIsProcessing(true);
    parseStatementMutation.mutate(file, {
      onSettled: () => setIsProcessing(false),
    });
  }, [file, parseStatementMutation]);

  const handleImportTransactions = useCallback(() => {
    if (!selectedAccount || selectedTransactions.size === 0) {
      toast({
        title: "Missing required data",
        description: "Please select an account and at least one transaction",
        variant: "destructive",
      });
      return;
    }
    
    importTransactionsMutation.mutate();
  }, [selectedAccount, selectedTransactions, importTransactionsMutation, toast]);

  const toggleTransactionSelection = useCallback((index: number) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTransactions(newSelected);
  }, [selectedTransactions]);

  const updateCategoryMapping = useCallback((description: string, categoryId: string) => {
    const newMappings = new Map(categoryMappings);
    newMappings.set(description, categoryId);
    setCategoryMappings(newMappings);
  }, [categoryMappings]);

  const findBestCategoryMatch = (description: string, categories: Category[]): Category | null => {
    const upperDesc = description.toUpperCase();
    
    // Look for exact matches first
    for (const category of categories) {
      if (upperDesc.includes(category.name.toUpperCase())) {
        return category;
      }
    }
    
    // Look for partial matches
    for (const category of categories) {
      const words = category.name.toUpperCase().split(' ');
      if (words.some(word => upperDesc.includes(word))) {
        return category;
      }
    }
    
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Bank Statement</DialogTitle>
          <DialogDescription>
            Upload a PDF bank statement to automatically import transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <Label htmlFor="statement-file">Select PDF Statement</Label>
            <div className="flex items-center space-x-4">
              <Input
                id="statement-file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="flex-1"
              />
              {file && (
                <Button
                  onClick={handleParseStatement}
                  disabled={isProcessing}
                  className="flex items-center space-x-2"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  <span>{isProcessing ? "Processing..." : "Parse Statement"}</span>
                </Button>
              )}
            </div>
            
            {file && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            )}
          </div>

          {/* Parse Results */}
          {parseResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Parsed Transactions</h3>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {selectedTransactions.size} of {parseResult.transactions.length} selected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allIndices = new Set(parseResult.transactions.map((_, index) => index));
                      setSelectedTransactions(allIndices);
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTransactions(new Set())}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Account Selection */}
              <div className="space-y-2">
                <Label htmlFor="account-select">Select Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account._id} value={account._id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transactions List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {parseResult.transactions.map((transaction, index) => (
                  <Card key={index} className={`cursor-pointer transition-colors ${
                    selectedTransactions.has(index) ? 'border-primary bg-primary/5' : ''
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(index)}
                            onChange={() => toggleTransactionSelection(index)}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{transaction.description}</span>
                              <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'}>
                                {transaction.type}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDateFull(transaction.date)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <span className={`font-semibold ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </span>
                          
                          {/* Category Mapping */}
                          <Select
                            value={categoryMappings.get(transaction.description) || ''}
                            onValueChange={(value) => updateCategoryMapping(transaction.description, value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category._id} value={category._id}>
                                  <div className="flex items-center space-x-2">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                                    <span>{category.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-destructive">Parsing Errors</h4>
                  <div className="space-y-1">
                    {parseResult.errors.map((error, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {parseResult && (
            <Button
              onClick={handleImportTransactions}
              disabled={importTransactionsMutation.isPending || selectedTransactions.size === 0 || !selectedAccount}
              className="flex items-center space-x-2"
            >
              {importTransactionsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <span>
                {importTransactionsMutation.isPending 
                  ? "Importing..." 
                  : `Import ${selectedTransactions.size} Transactions`
                }
              </span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
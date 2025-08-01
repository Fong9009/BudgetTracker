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
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, Edit } from "lucide-react";
import { formatCurrency, formatDateFull, highlightTransactionPrefix } from "@/lib/utils";
import { apiRequest, getValidToken } from "@/lib/queryClient";
import type { Account, Category } from "@shared/schema";

// Import getCSRFToken function
async function getCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/csrf-token", {
      method: "GET",
      credentials: "include",
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.csrfToken;
    }
  } catch (error) {
    console.warn("Failed to get CSRF token:", error);
  }
  
  return null;
}

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
  const [editingTransactions, setEditingTransactions] = useState<Map<number, ParsedTransaction>>(new Map());
  const [reverseAmountLogic, setReverseAmountLogic] = useState(false);
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
    mutationFn: async ({ file, reverseLogic }: { file: File; reverseLogic: boolean }) => {
      const formData = new FormData();
      formData.append('statement', file);
      formData.append('reverseLogic', reverseLogic.toString());
      
      const token = await getValidToken();
      if (!token) throw new Error("No valid token");
      
      // Get CSRF token for file upload
      const csrfToken = await getCSRFToken();
      
      // For file uploads, we need to handle FormData differently
      const response = await fetch("/api/statements/parse", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
          // Don't set Content-Type for FormData, let browser set it with boundary
        },
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) {
        // If CSRF error, try to get a new token and retry once
        if (response.status === 403) {
          try {
            const errorJson = await response.clone().json();
            if (errorJson?.message?.toLowerCase().includes('csrf') || errorJson?.error?.toLowerCase().includes('csrf')) {
              const newCSRFToken = await getCSRFToken();
              const retryResponse = await fetch("/api/statements/parse", {
                method: "POST",
                headers: { 
                  Authorization: `Bearer ${token}`,
                  ...(newCSRFToken && { "X-CSRF-Token": newCSRFToken }),
                },
                credentials: "include",
                body: formData,
              });
              
              if (!retryResponse.ok) {
                const error = await retryResponse.text();
                throw new Error(error);
              }
              
              return retryResponse.json();
            }
          } catch (e) {
            // Fall through to throw original error
          }
        }
        
        const error = await response.text();
        throw new Error(error);
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      setParseResult(result);
      // Auto-select all transactions
      const allIndices = new Set<number>(result.transactions.map((_: ParsedTransaction, index: number) => index));
      setSelectedTransactions(allIndices);
      
      // Auto-map categories based on description keywords
      const mappings = new Map<string, string>();
      result.transactions.forEach((transaction: ParsedTransaction) => {
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
      
      const selectedTransactionsList = parseResult.transactions.filter((_: ParsedTransaction, index: number) => 
        selectedTransactions.has(index)
      ).map((transaction, originalIndex) => {
        // Use edited transaction if available, otherwise use original
        const actualIndex = parseResult.transactions.indexOf(transaction);
        const editedTransaction = editingTransactions.get(actualIndex);
        return editedTransaction || transaction;
      });
      
      const token = await getValidToken();
      if (!token) throw new Error("No valid token");
      
      // Get CSRF token for import request
      const csrfToken = await getCSRFToken();
      
      // Use apiRequest for proper error handling and token refresh
      return await apiRequest('POST', '/api/statements/import', {
        accountId: selectedAccount,
        transactions: selectedTransactionsList.map((tx: ParsedTransaction) => ({
          ...tx,
          categoryId: categoryMappings.get(tx.description) || categories[0]?._id,
        })),
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
      });
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
      setEditingTransactions(new Map());
      
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
    if (selectedFile) {
      // Check for supported file types
      const supportedTypes = [
        'text/csv',
        'application/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
      ];
      
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      const supportedExtensions = ['.csv', '.xlsx', '.xls'];
      
      if (supportedTypes.includes(selectedFile.type) || supportedExtensions.includes(fileExtension)) {
        setFile(selectedFile);
        setParseResult(null);
        setSelectedTransactions(new Set());
        setCategoryMappings(new Map());
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV or Excel file",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleParseStatement = useCallback(() => {
    if (!file) return;
    
    setIsProcessing(true);
    parseStatementMutation.mutate({ file, reverseLogic: reverseAmountLogic }, {
      onSettled: () => setIsProcessing(false),
    });
  }, [file, reverseAmountLogic, parseStatementMutation]);

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

  // Transaction editing functions
  const startEditingTransaction = useCallback((index: number) => {
    const transaction = parseResult?.transactions[index];
    if (transaction) {
      const newEditing = new Map(editingTransactions);
      // Ensure date is a proper Date object for editing
      const editingTransaction = {
        ...transaction,
        date: transaction.date instanceof Date ? transaction.date : new Date(transaction.date)
      };
      newEditing.set(index, editingTransaction);
      setEditingTransactions(newEditing);
    }
  }, [parseResult, editingTransactions]);

  const saveTransactionEdit = useCallback((index: number) => {
    const editedTransaction = editingTransactions.get(index);
    if (editedTransaction && parseResult) {
      const newTransactions = [...parseResult.transactions];
      newTransactions[index] = editedTransaction;
      setParseResult({ ...parseResult, transactions: newTransactions });
      
      const newEditing = new Map(editingTransactions);
      newEditing.delete(index);
      setEditingTransactions(newEditing);
    }
  }, [editingTransactions, parseResult]);

  const cancelTransactionEdit = useCallback((index: number) => {
    const newEditing = new Map(editingTransactions);
    newEditing.delete(index);
    setEditingTransactions(newEditing);
  }, [editingTransactions]);

  const updateTransactionField = useCallback((index: number, field: keyof ParsedTransaction, value: any) => {
    const editedTransaction = editingTransactions.get(index);
    if (editedTransaction) {
      const newEditing = new Map(editingTransactions);
      newEditing.set(index, { ...editedTransaction, [field]: value });
      setEditingTransactions(newEditing);
    }
  }, [editingTransactions]);

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
            Upload a CSV or Excel bank statement to automatically import transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <Label htmlFor="statement-file">Select Statement File</Label>
            
            {/* Clickable Upload Area */}
            <div className="relative">
                          <input
              id="statement-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary hover:bg-primary/5 transition-all duration-200 cursor-pointer group">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-gray-900">
                      {file ? file.name : "Click to upload statement"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {file 
                        ? `File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`
                        : "Drag and drop your bank statement CSV or Excel file here, or click to browse"
                      }
                    </p>
                  </div>
                  {!file && (
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <FileText className="h-4 w-4" />
                      <span>Supports CSV and Excel files</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Bank Format Toggle */}
            {file && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Bank Statement Format</Label>
                  <p className="text-xs text-gray-500">
                    Toggle if transactions are incorrectly categorized
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-600">Standard</span>
                  <button
                    type="button"
                    onClick={() => setReverseAmountLogic(!reverseAmountLogic)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                      reverseAmountLogic ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        reverseAmountLogic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-gray-600">Reversed</span>
                </div>
              </div>
            )}
            
            {/* Parse Button */}
            {file && (
              <Button
                onClick={handleParseStatement}
                disabled={isProcessing}
                className="w-full flex items-center justify-center space-x-2 h-12 text-base font-medium"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing Statement...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5" />
                    <span>Parse Statement</span>
                  </>
                )}
              </Button>
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
                {parseResult.transactions.map((transaction, index) => {
                  const isEditing = editingTransactions.has(index);
                  const editedTransaction = editingTransactions.get(index) || transaction;
                  
                  return (
                    <Card key={index} className={`transition-colors ${
                      selectedTransactions.has(index) ? 'border-primary bg-primary/5' : ''
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-4">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(index)}
                            onChange={() => toggleTransactionSelection(index)}
                            className="h-4 w-4 mt-1"
                          />
                          
                          {/* Description */}
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <Input
                                value={editedTransaction.description}
                                onChange={(e) => updateTransactionField(index, 'description', e.target.value)}
                                className="w-full"
                                placeholder="Transaction description"
                              />
                            ) : (
                              <div 
                                className="font-medium cursor-pointer hover:bg-muted px-2 py-1 rounded transition-colors"
                                onClick={() => startEditingTransaction(index)}
                                title="Click to edit"
                              >
                                {(() => {
                                  const result = highlightTransactionPrefix(transaction.description);
                                  return result.hasPrefix ? (
                                    <>
                                      <span className={`${result.color} font-semibold px-1.5 py-0.5 rounded text-xs`}>
                                        {result.prefix}
                                      </span>
                                      {result.rest}
                                    </>
                                  ) : (
                                    result.rest
                                  );
                                })()}
                              </div>
                            )}
                            
                            {/* Date and Amount Row */}
                            <div className="flex items-center space-x-4 mt-2">
                              {/* Date */}
                              {isEditing ? (
                                <Input
                                  type="date"
                                  value={(() => {
                                    const date = editedTransaction.date instanceof Date 
                                      ? editedTransaction.date 
                                      : new Date(editedTransaction.date);
                                    // Format as YYYY-MM-DD in local timezone
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    return `${year}-${month}-${day}`;
                                  })()}
                                  onChange={(e) => {
                                    const newDate = new Date(e.target.value);
                                    updateTransactionField(index, 'date', newDate);
                                  }}
                                  className="w-40"
                                />
                              ) : (
                                <div 
                                  className="text-sm text-muted-foreground cursor-pointer hover:bg-muted px-2 py-1 rounded transition-colors"
                                  onClick={() => startEditingTransaction(index)}
                                  title="Click to edit"
                                >
                                  {formatDateFull(transaction.date)}
                                </div>
                              )}
                              
                              {/* Amount */}
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editedTransaction.amount}
                                  onChange={(e) => updateTransactionField(index, 'amount', parseFloat(e.target.value) || 0)}
                                  className="w-32"
                                  placeholder="0.00"
                                />
                              ) : (
                                <span 
                                  className={`font-semibold cursor-pointer hover:bg-muted px-2 py-1 rounded transition-colors ${
                                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                  }`}
                                  onClick={() => startEditingTransaction(index)}
                                  title="Click to edit"
                                >
                                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Type Badge */}
                          <div className="flex-shrink-0">
                            {isEditing ? (
                              <Select
                                value={editedTransaction.type}
                                onValueChange={(value: 'income' | 'expense') => updateTransactionField(index, 'type', value)}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="income">Income</SelectItem>
                                  <SelectItem value="expense">Expense</SelectItem>
                                </SelectContent>
                              </Select>
                                                         ) : (
                               <Select
                                 value={transaction.type}
                                 onValueChange={(value: 'income' | 'expense') => {
                                   // Update the transaction directly without entering edit mode
                                   const updatedTransaction = { ...transaction, type: value };
                                   const newEditingTransactions = new Map(editingTransactions);
                                   newEditingTransactions.set(index, updatedTransaction);
                                   setEditingTransactions(newEditingTransactions);
                                 }}
                               >
                                 <SelectTrigger className="w-24 h-6 text-xs">
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="income">Income</SelectItem>
                                   <SelectItem value="expense">Expense</SelectItem>
                                 </SelectContent>
                               </Select>
                             )}
                          </div>
                          
                          {/* Category Mapping */}
                          <div className="flex-shrink-0">
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
                          
                          {/* Save/Cancel Buttons - only show when editing */}
                          {isEditing && (
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Button
                                size="sm"
                                onClick={() => saveTransactionEdit(index)}
                                className="h-8 px-2"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelTransactionEdit(index)}
                                className="h-8 px-2"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
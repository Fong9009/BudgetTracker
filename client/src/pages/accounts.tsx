import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddAccountModal } from "@/components/modals/add-account-modal";
import { EditAccountModal } from "@/components/modals/edit-account-modal";
import { TransferModal } from "@/components/modals/transfer-modal";
import { SortableGrid } from "@/components/ui/sortable-grid";
import { formatCurrency, getAccountTypeIcon, getAccountTypeColor, getTransactionTypeColor, highlightTransactionPrefix, calculateAccountFinancialSummary } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getValidToken } from "@/lib/queryClient";
import { Plus, Edit2, Trash2, ArrowRightLeft, Archive, X, Receipt, List, Table } from "lucide-react";
import { useLocation } from "wouter";
import type { Account, TransactionWithDetails } from "@shared/schema";

export default function Accounts() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [archiveAccount, setArchiveAccount] = useState<string | null>(null);
  const [accountOrder, setAccountOrder] = useState<string[]>([]);
  const [viewingAccountTransactions, setViewingAccountTransactions] = useState<Account | null>(null);
  const [transactionViewMode, setTransactionViewMode] = useState<'list' | 'table'>('table');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    enabled: isAuthenticated && !authLoading,
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) return [];
      
      try {
        const response = await fetch("/api/accounts", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        
        if (response.status === 401) return [];
        if (!response.ok) throw new Error("Failed to fetch accounts");
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error fetching accounts:", error);
        return [];
      }
    },
  });

  const { data: accountTransactions = [], isLoading: transactionsLoading } = useQuery<TransactionWithDetails[]>({
    queryKey: ["/api/transactions", viewingAccountTransactions?._id],
    enabled: isAuthenticated && !authLoading && !!viewingAccountTransactions,
    queryFn: async () => {
      const token = await getValidToken();
      if (!token || !viewingAccountTransactions) return [];
      
      try {
        const response = await fetch(`/api/transactions?accountId=${viewingAccountTransactions._id}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        
        if (response.status === 401) return [];
        if (!response.ok) throw new Error("Failed to fetch account transactions");
        
        const data = await response.json();
        return data.transactions || [];
      } catch (error) {
        console.error("Error fetching account transactions:", error);
        return [];
      }
    },
  });

  // Fetch transactions for all accounts to calculate summaries
  const { data: allTransactions = [], isLoading: allTransactionsLoading } = useQuery<TransactionWithDetails[]>({
    queryKey: ["/api/transactions", "all"],
    enabled: isAuthenticated && !authLoading,
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) return [];
      
      try {
        const response = await fetch("/api/transactions", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        
        if (response.status === 401) return [];
        if (!response.ok) throw new Error("Failed to fetch all transactions");
        
        const data = await response.json();
        return data.transactions || [];
      } catch (error) {
        console.error("Error fetching all transactions:", error);
        return [];
      }
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: "Account archived successfully",
        variant: "success",
      });
      setArchiveAccount(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive account",
        variant: "destructive",
      });
    },
  });

  const handleArchive = (id: string) => {
    archiveMutation.mutate(id);
  };

  const handleEdit = (account: Account) => {
    setSelectedAccount(account);
    setShowEditAccount(true);
  };

  const handleViewTransactions = (account: Account) => {
    setViewingAccountTransactions(account);
  };

  const handleCloseTransactions = () => {
    setViewingAccountTransactions(null);
  };

  const handleReorder = (newOrder: Account[]) => {
    setAccountOrder(newOrder.map(account => account._id));
  };

  const sortedAccounts = useMemo(() => {
    if (accountOrder.length === 0) return accounts;
    
    const orderedAccounts = accountOrder
      .map(id => accounts.find(account => account._id === id))
      .filter(Boolean) as Account[];
    
    const remainingAccounts = accounts.filter(account => !accountOrder.includes(account._id));
    
    return [...orderedAccounts, ...remainingAccounts];
  }, [accounts, accountOrder]);

  if (!isAuthenticated && !authLoading) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Accounts</h1>
          <p className="text-muted-foreground">
            Manage your bank accounts, credit cards, and other financial accounts
          </p>
        </div>

        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setShowTransferModal(true)}
                variant="outline"
                className="border-dashed"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transfer
              </Button>
              <Button
                onClick={() => setShowAddAccount(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>
          </div>

          {/* Total Balance Summary */}
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Total Balance
                </h3>
                <p className={`text-3xl font-bold mt-2 ${accounts.reduce((sum, account) => sum + account.balance, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${accounts.reduce((sum, account) => sum + account.balance, 0).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Accounts Grid */}
          <div className="mt-8">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-muted rounded-lg" />
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-24" />
                            <div className="h-3 bg-muted rounded w-16" />
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <div className="w-8 h-8 bg-muted rounded" />
                          <div className="w-8 h-8 bg-muted rounded" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-6 bg-muted rounded w-20" />
                        <div className="h-3 bg-muted rounded w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <i className="fas fa-wallet text-muted-foreground text-xl" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">
                  No accounts yet
                </p>
                <p className="text-muted-foreground mb-4">
                  Add your first account to start tracking your finances
                </p>
                <Button
                  onClick={() => setShowAddAccount(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </div>
            ) : (
              <SortableGrid
                items={sortedAccounts}
                onReorder={handleReorder}
                className="md:grid-cols-2 lg:grid-cols-3"
                getId={(account) => account._id}
              >
                {(account) => (
                  <Card className="hover:shadow-md transition-shadow relative">
                    <CardContent className="pt-6 relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className={`w-12 h-12 ${getAccountTypeColor(account.type)} rounded-lg flex items-center justify-center`}>
                            <i className={`${getAccountTypeIcon(account.type)} text-white text-lg`} />
                          </div>
                          <div className="ml-4">
                            <h3 className="text-lg font-semibold text-foreground">
                              {account.name}
                            </h3>
                            <p className="text-sm text-muted-foreground capitalize">
                              {account.type} Account
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Current Balance</span>
                        </div>
                        <p className={`text-2xl font-bold ${
                          account.balance >= 0 ? 'text-foreground' : 'text-red-600'
                        }`}>
                          ${account.balance.toFixed(2)}
                        </p>
                      </div>

                      {/* Financial Summary */}
                      {(() => {
                        const accountTransactions = allTransactions.filter(t => t.accountId === account._id);
                        const summary = calculateAccountFinancialSummary(account, accountTransactions);
                        return (
                          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Initial Balance</p>
                                <p className="font-medium">{formatCurrency(summary.initialBalance)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Current Balance</p>
                                <p className="font-medium">{formatCurrency(summary.currentBalance)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Income</p>
                                <p className="font-medium text-green-600">+{formatCurrency(summary.totalIncome)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Expense</p>
                                <p className="font-medium text-red-600">-{formatCurrency(summary.totalExpense)}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-muted-foreground">Net Change</p>
                                <p className={`font-medium ${summary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {summary.netChange >= 0 ? '+' : ''}{formatCurrency(summary.netChange)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {account.type === 'credit' && account.balance < 0 && (
                        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                          <p className="text-xs text-orange-700 dark:text-orange-400">
                            Outstanding balance on credit card
                          </p>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewTransactions(account)}
                          className="w-full"
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          View Transactions
                        </Button>
                        
                        <div className="flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(account)}
                            className="flex-1"
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setArchiveAccount(account._id)}
                            className="flex-1 text-orange-600 hover:text-orange-700"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </SortableGrid>
            )}
          </div>

          {/* Account Transactions View */}
          {viewingAccountTransactions && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      {viewingAccountTransactions.name} - Transactions
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {/* View Mode Toggle */}
                      <div className="flex items-center border rounded-md">
                        <Button
                          variant={transactionViewMode === 'list' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTransactionViewMode('list')}
                          className="rounded-r-none"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={transactionViewMode === 'table' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTransactionViewMode('table')}
                          className="rounded-l-none"
                        >
                          <Table className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCloseTransactions}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Close
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Financial Summary */}
                  {(() => {
                    const summary = calculateAccountFinancialSummary(viewingAccountTransactions, accountTransactions);
                    return (
                      <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                        <h3 className="text-sm font-semibold text-foreground mb-3">Financial Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Initial Balance</p>
                            <p className="font-medium">{formatCurrency(summary.initialBalance)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Income</p>
                            <p className="font-medium text-green-600">+{formatCurrency(summary.totalIncome)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Expense</p>
                            <p className="font-medium text-red-600">-{formatCurrency(summary.totalExpense)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Net Change</p>
                            <p className={`font-medium ${summary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {summary.netChange >= 0 ? '+' : ''}{formatCurrency(summary.netChange)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Current Balance</p>
                            <p className="font-medium">{formatCurrency(summary.currentBalance)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {transactionsLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="animate-pulse flex items-center justify-between p-4 border-b border-border">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-muted rounded-lg" />
                            <div className="space-y-2">
                              <div className="h-4 bg-muted rounded w-32" />
                              <div className="h-3 bg-muted rounded w-24" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-20" />
                            <div className="h-3 bg-muted rounded w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : accountTransactions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No transactions found for this account.</p>
                    </div>
                  ) : transactionViewMode === 'list' ? (
                    <div className="space-y-0 divide-y divide-border">
                      {accountTransactions.map((transaction) => (
                        <div key={transaction._id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center flex-1">
                            <div className="flex-shrink-0">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: transaction.category.color, color: 'white' }}
                              >
                                <i className={`${transaction.category.icon} text-sm`} />
                              </div>
                            </div>
                            <div className="ml-4 flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-foreground">
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
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {transaction.category.name}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-medium ${getTransactionTypeColor(transaction.type)}`}>
                                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(transaction.date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Transaction Details</th>
                            <th className="text-right p-3 text-sm font-medium text-muted-foreground">Money In</th>
                            <th className="text-right p-3 text-sm font-medium text-muted-foreground">Money Out</th>
                            <th className="text-right p-3 text-sm font-medium text-muted-foreground">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            let runningBalance = viewingAccountTransactions.balance || 0;
                            return accountTransactions.map((transaction, index) => {
                              const isIncome = transaction.type === 'income';
                              const amount = transaction.amount;
                              
                              // Calculate running balance
                              if (isIncome) {
                                runningBalance += amount;
                              } else {
                                runningBalance -= amount;
                              }
                              
                              return (
                                <tr key={transaction._id} className="border-b border-border hover:bg-muted/50 transition-colors">
                                  <td className="p-3 text-sm text-muted-foreground">
                                    {new Date(transaction.date).toLocaleDateString()}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: transaction.category.color, color: 'white' }}
                                      >
                                        <i className={`${transaction.category.icon} text-xs`} />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-foreground">
                                          {(() => {
                                            const result = highlightTransactionPrefix(transaction.description);
                                            return result.hasPrefix ? (
                                              <>
                                                <span className={`${result.color} font-semibold px-1 py-0.5 rounded text-xs`}>
                                                  {result.prefix}
                                                </span>
                                                {result.rest}
                                              </>
                                            ) : (
                                              result.rest
                                            );
                                          })()}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {transaction.category.name}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 text-right">
                                    {isIncome ? (
                                      <span className="text-sm font-medium text-green-600">
                                        {formatCurrency(amount)}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">-</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    {!isIncome ? (
                                      <span className="text-sm font-medium text-red-600">
                                        {formatCurrency(amount)}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">-</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    <span className="text-sm font-medium">
                                      {formatCurrency(runningBalance)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Modals */}
        <AddAccountModal open={showAddAccount} onOpenChange={setShowAddAccount} />
        <EditAccountModal open={showEditAccount} onOpenChange={setShowEditAccount} account={selectedAccount} />
        <TransferModal open={showTransferModal} onOpenChange={setShowTransferModal} />

        {/* Archive Confirmation */}
        <AlertDialog open={archiveAccount !== null} onOpenChange={() => setArchiveAccount(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Account</AlertDialogTitle>
              <AlertDialogDescription>
                This will move the account to your archive. You can restore it later from the archived accounts page.
                Note: You cannot archive an account that has active transactions. Please archive or delete those transactions first.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => archiveAccount && handleArchive(archiveAccount)}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {archiveMutation.isPending ? "Archiving..." : "Archive"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

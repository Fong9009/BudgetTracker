import React, { useState } from "react";
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
import { formatCurrency, getAccountTypeIcon, getAccountTypeColor, getTransactionTypeColor } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getValidToken } from "@/lib/queryClient";
import { Plus, Edit2, Trash2, ArrowRightLeft, Archive, X, Receipt } from "lucide-react";
import { useLocation } from "wouter";
import type { Account, TransactionWithDetails } from "@shared/schema";

export default function Accounts() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<string | null>(null);
  const [accountOrder, setAccountOrder] = useState<string[]>([]);
  const [viewingAccountTransactions, setViewingAccountTransactions] = useState<Account | null>(null);
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: "Account archived successfully. You can restore it from the archive if needed.",
        variant: "success",
      });
      setDeleteAccount(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive account",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
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
    // Here you could also save the order to localStorage or send to server
    localStorage.setItem('accountOrder', JSON.stringify(newOrder.map(account => account._id)));
  };

  // Sort accounts based on saved order or default order
  const sortedAccounts = React.useMemo(() => {
    if (accountOrder.length > 0) {
      const orderMap = new Map(accountOrder.map((id, index) => [id, index]));
      const sorted = [...accounts].sort((a, b) => {
        const aIndex = orderMap.get(a._id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = orderMap.get(b._id) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      });
      return sorted;
    }
    return accounts;
  }, [accounts, accountOrder]);

  // Load saved order on mount
  React.useEffect(() => {
    const savedOrder = localStorage.getItem('accountOrder');
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        // Validate that the saved order contains valid IDs
        if (Array.isArray(parsedOrder) && parsedOrder.every(id => typeof id === 'string')) {
          setAccountOrder(parsedOrder);
        } else {
          console.warn('Invalid account order found in localStorage, clearing it');
          localStorage.removeItem('accountOrder');
        }
      } catch (error) {
        console.error('Failed to parse saved account order:', error);
        localStorage.removeItem('accountOrder');
      }
    }
  }, []);

  return (
    <div className="flex-1 relative overflow-y-auto focus:outline-none">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page header */}
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-semibold text-foreground sm:truncate">
                Accounts
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your financial accounts and balances
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4 space-x-2">
              <Button
                variant="outline"
                onClick={() => setLocation("/accounts/archived")}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                View Archive
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowTransferModal(true)}
                disabled={accounts.length < 2}
                className="flex items-center gap-2"
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
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
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
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(account)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteAccount(account._id)}
                            className="text-orange-600 hover:text-orange-700"
                            title="Archive account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

                      {account.type === 'credit' && account.balance < 0 && (
                        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                          <p className="text-xs text-orange-700 dark:text-orange-400">
                            Outstanding balance on credit card
                          </p>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewTransactions(account)}
                          className="w-full"
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          View Transactions
                        </Button>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseTransactions}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Close
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
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
                  ) : (
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
                                    {transaction.description}
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
        <AlertDialog open={deleteAccount !== null} onOpenChange={() => setDeleteAccount(null)}>
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
                onClick={() => deleteAccount && handleDelete(deleteAccount)}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {deleteMutation.isPending ? "Archiving..." : "Archive"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

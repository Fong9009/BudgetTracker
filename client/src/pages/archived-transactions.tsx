import { useState } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateFull, getTransactionTypeColor, groupTransferTransactions, type TransactionOrTransfer } from "@/lib/utils";
import { RotateCcw, Trash2, ArrowLeft, ArrowRightLeft } from "lucide-react";
import { useLocation } from "wouter";
import type { TransactionWithDetails } from "@shared/schema";
import { getValidToken } from "@/lib/queryClient";

export default function ArchivedTransactions() {
  const [restoreTransaction, setRestoreTransaction] = useState<string | null>(null);
  const [permanentDeleteTransaction, setPermanentDeleteTransaction] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: archivedTransactions = [], isLoading } = useQuery<TransactionWithDetails[]>({
    queryKey: ["/api/transactions/archived"],
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) return [];
      
      try {
        const response = await fetch("/api/transactions/archived", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        
        if (response.status === 401) return [];
        if (!response.ok) throw new Error("Failed to fetch archived transactions");
        
        return response.json();
      } catch (error) {
        console.error("Error fetching archived transactions:", error);
        return [];
      }
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/transactions/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: "Transaction restored successfully",
        variant: "success",
      });
      setRestoreTransaction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore transaction",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/transactions/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/archived"] });
      toast({
        title: "Success",
        description: "Transaction permanently deleted",
        variant: "success",
      });
      setPermanentDeleteTransaction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to permanently delete transaction",
        variant: "destructive",
      });
    },
  });

  const handleRestore = (id: string) => {
    restoreMutation.mutate(id);
  };

  const handlePermanentDelete = (id: string) => {
    permanentDeleteMutation.mutate(id);
  };

  // Group transfers for display
  const groupedTransactions = groupTransferTransactions(archivedTransactions);

  return (
    <div className="flex-1 relative overflow-y-auto focus:outline-none">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/transactions")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Transactions
              </Button>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Archived Transactions
                </h2>
                <p className="text-sm text-muted-foreground">
                  Restore or permanently delete archived transactions
                </p>
              </div>
            </div>
          </div>

          {/* Archived Transactions List */}
          <div className="mt-8">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : groupedTransactions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                    <i className="fas fa-archive text-muted-foreground text-xl" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">
                    No archived transactions
                  </p>
                  <p className="text-muted-foreground">
                    Deleted transactions will appear here for recovery
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {groupedTransactions.map((item) => (
                  <Card key={item.type === 'transfer' ? `transfer-${item._id}` : item._id} className="border-destructive/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 ${item.type === 'transfer' ? 'bg-blue-500' : getTransactionTypeColor(item.type)} rounded-lg flex items-center justify-center opacity-60`}>
                              {item.type === 'transfer' ? (
                                <ArrowRightLeft className="h-5 w-5 text-white" />
                              ) : (
                                <i className={`${item.category.icon} text-white text-sm`} />
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {item.type === 'transfer' ? item.description : item.description}
                              </p>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                item.type === 'transfer' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                item.type === 'income' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                              }`}>
                                {item.type === 'transfer' ? 'Transfer' : item.type === 'income' ? 'Income' : 'Expense'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-muted-foreground">
                                {item.type === 'transfer' ? `${item.fromAccount} → ${item.toAccount}` : `${item.account.name} • ${item.category.name}`}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatDateFull(item.date)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`text-sm font-medium ${
                              item.type === 'transfer' ? 'text-foreground' :
                              item.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {item.type === 'transfer' ? formatCurrency(item.amount.toString()) :
                               item.type === 'income' ? `+${formatCurrency(item.amount.toString())}` : 
                               `-${formatCurrency(item.amount.toString())}`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRestoreTransaction(item._id)}
                              className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPermanentDeleteTransaction(item._id)}
                              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreTransaction !== null} onOpenChange={() => setRestoreTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this transaction? It will be moved back to your active transactions and account balances will be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreTransaction && handleRestore(restoreTransaction)}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {restoreMutation.isPending ? "Restoring..." : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={permanentDeleteTransaction !== null} onOpenChange={() => setPermanentDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this transaction? This action cannot be undone.
              Account balances will not be affected since this transaction is already archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => permanentDeleteTransaction && handlePermanentDelete(permanentDeleteTransaction)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {permanentDeleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 
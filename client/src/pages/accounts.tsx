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
import { AddAccountModal } from "@/components/modals/add-account-modal";
import { EditAccountModal } from "@/components/modals/edit-account-modal";
import { TransferModal } from "@/components/modals/transfer-modal";
import { formatCurrency, getAccountTypeIcon, getAccountTypeColor } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, ArrowRightLeft } from "lucide-react";
import type { Account } from "@shared/schema";

export default function Accounts() {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: "Account deleted successfully",
        variant: "success",
      });
      setDeleteAccount(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((account) => (
                  <Card key={account._id} className="hover:shadow-md transition-shadow">
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
                            className="text-destructive hover:text-destructive"
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <AddAccountModal open={showAddAccount} onOpenChange={setShowAddAccount} />
        <EditAccountModal open={showEditAccount} onOpenChange={setShowEditAccount} account={selectedAccount} />
        <TransferModal open={showTransferModal} onOpenChange={setShowTransferModal} />

        {/* Delete Confirmation */}
        <AlertDialog open={deleteAccount !== null} onOpenChange={() => setDeleteAccount(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the account
                and all associated transactions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAccount && handleDelete(deleteAccount)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

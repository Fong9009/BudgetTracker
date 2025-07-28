import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getValidToken } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import type { TransactionWithDetails, Account, Category } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface EditTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionWithDetails | null;
}

export function EditTransactionModal({ open, onOpenChange, transaction }: EditTransactionModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<string>("expense");
  const [date, setDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load accounts and categories when modal opens
  useEffect(() => {
    if (open) {
      loadAccounts();
      loadCategories();
    }
  }, [open]);

  // Update form when transaction changes
  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description);
      setAmount(Math.abs(transaction.amount).toString());
      setType(transaction.type);
      // Handle date - convert to string and extract date part
      const dateStr = String(transaction.date);
      const dateValue = dateStr.split('T')[0];
      setDate(dateValue);
      setAccountId(transaction.account._id);
      setCategoryId(transaction.category._id);
    }
  }, [transaction]);

  const loadAccounts = async () => {
    try {
      const token = await getValidToken();
      if (!token) return;
      
      const response = await fetch("/api/accounts", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const token = await getValidToken();
      if (!token) return;
      
      const response = await fetch("/api/categories", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const updateTransactionMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error("No transaction to update");
      
      const token = await getValidToken();
      if (!token) throw new Error("No valid token");

      const updateData = {
        description,
        amount: type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
        type,
        date,
        accountId,
        categoryId,
      };

      return await apiRequest('PUT', `/api/transactions/${transaction._id}`, updateData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
    },
    onSuccess: () => {
      toast({
        title: "Transaction updated successfully",
        description: "The transaction has been updated and account balances adjusted.",
      });
      
      // Reset form
      setDescription("");
      setAmount("");
      setType("expense");
      setDate("");
      setAccountId("");
      setCategoryId("");
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      
      // Close modal
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update transaction",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      toast({
        title: "Missing description",
        description: "Please enter a transaction description",
        variant: "destructive",
      });
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }
    
    if (!date) {
      toast({
        title: "Missing date",
        description: "Please select a transaction date",
        variant: "destructive",
      });
      return;
    }
    
    if (!accountId) {
      toast({
        title: "Missing account",
        description: "Please select an account",
        variant: "destructive",
      });
      return;
    }
    
    if (!categoryId) {
      toast({
        title: "Missing category",
        description: "Please select a category",
        variant: "destructive",
      });
      return;
    }
    
    updateTransactionMutation.mutate();
  };

  const handleCancel = () => {
    // Reset form to original values
    if (transaction) {
      setDescription(transaction.description);
      setAmount(Math.abs(transaction.amount).toString());
      setType(transaction.type);
      // Handle date - convert to string and extract date part
      const dateStr = String(transaction.date);
      const dateValue = dateStr.split('T')[0];
      setDate(dateValue);
      setAccountId(transaction.account._id);
      setCategoryId(transaction.category._id);
    }
    onOpenChange(false);
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Update the transaction details. Changes will affect your account balance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Transaction description"
              required
            />
          </div>

          {/* Amount and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(value: string) => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label htmlFor="account">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
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

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
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

          {/* Preview */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Preview:</p>
            <p className="font-medium">{description}</p>
            <p className={`text-sm font-medium ${
              type === 'income' ? 'text-green-600' : 'text-red-600'
            }`}>
              {type === 'income' ? '+' : '-'}{formatCurrency(parseFloat(amount) || 0)}
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateTransactionMutation.isPending}
            className="flex items-center space-x-2"
          >
            {updateTransactionMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            <span>
              {updateTransactionMutation.isPending ? "Updating..." : "Update Transaction"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
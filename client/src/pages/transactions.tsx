import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AddTransactionModal } from "@/components/modals/add-transaction-modal";
import { TransferModal } from "@/components/modals/transfer-modal";
import { ExportModal } from "@/components/export/export-modal";
import { formatCurrency, formatDateFull, getTransactionTypeColor, debounce, cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit2, Trash2, Download, Calendar as CalendarIcon, Filter, ChevronDown, X, SlidersHorizontal, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import type { TransactionWithDetails, Account, Category } from "@shared/schema";

export default function Transactions() {
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedTransactionKind, setSelectedTransactionKind] = useState<string>("all");
  const [deleteTransaction, setDeleteTransaction] = useState<string | null>(null);
  
  // Advanced filtering states
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery<TransactionWithDetails[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const filteredCategoriesForDropdown = categories.filter(c => c.name !== 'Transfer');

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transactions/${id.toString()}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      });
      setDeleteTransaction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete transaction",
        variant: "destructive",
      });
    },
  });

  // Filter and sort transactions based on all criteria
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter((transaction) => {
      // Text search (description, account name, category name)
      const searchText = searchTerm.toLowerCase();
      const matchesSearch = !searchText || 
        transaction.description.toLowerCase().includes(searchText) ||
        transaction.account.name.toLowerCase().includes(searchText) ||
        transaction.category.name.toLowerCase().includes(searchText);
      
      // Filter by account
      const matchesAccount = selectedAccount === "all" || transaction.accountId === selectedAccount;
      
      // Filter by category
      const matchesCategory = selectedCategory === "all" || transaction.categoryId === selectedCategory;
      
      // Filter by type
      const matchesType = selectedType === "all" || transaction.type === selectedType;
      
      // Filter by transaction kind
      const isTransfer = transaction.description.startsWith("Transfer to");
      const matchesKind = selectedTransactionKind === "all" ||
        (selectedTransactionKind === "transfer" && isTransfer) ||
        (selectedTransactionKind === "transaction" && !isTransfer);

      // Filter by date range
      const transactionDate = new Date(transaction.date);
      const matchesDateFrom = !dateFrom || transactionDate >= dateFrom;
      const matchesDateTo = !dateTo || transactionDate <= dateTo;
      
      // Filter by amount range
      const amount = Math.abs(transaction.amount);
      const matchesAmountMin = !amountMin || amount >= parseFloat(amountMin);
      const matchesAmountMax = !amountMax || amount <= parseFloat(amountMax);

      return matchesSearch && matchesAccount && matchesCategory && matchesType && 
             matchesKind && matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax;
    });

    // Sort transactions
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "amount":
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
          break;
        case "description":
          comparison = a.description.localeCompare(b.description);
          break;
        case "account":
          comparison = a.account.name.localeCompare(b.account.name);
          break;
        case "category":
          comparison = a.category.name.localeCompare(b.category.name);
          break;
        default:
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, searchTerm, selectedAccount, selectedCategory, selectedType, 
      selectedTransactionKind, dateFrom, dateTo, amountMin, amountMax, sortBy, sortOrder]);

  // Debounced search handler
  const handleSearchChange = debounce((value: string) => {
    setSearchTerm(value);
  }, 300);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedAccount("all");
    setSelectedCategory("all");
    setSelectedType("all");
    setSelectedTransactionKind("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setAmountMin("");
    setAmountMax("");
    setSortBy("date");
    setSortOrder("desc");
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || selectedAccount !== "all" || selectedCategory !== "all" || 
    selectedType !== "all" || selectedTransactionKind !== "all" || dateFrom || dateTo || amountMin || amountMax;

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="flex-1 relative overflow-y-auto focus:outline-none">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page header */}
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-semibold text-foreground sm:truncate">
                Transactions
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage all your financial transactions
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4 space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
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
                onClick={() => setShowAddTransaction(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter & Search Transactions
                  {hasActiveFilters && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                      {filteredAndSortedTransactions.length} results
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="flex items-center gap-2"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Advanced
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvancedFilters && "rotate-180")} />
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearAllFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Search Input */}
                <div className="lg:col-span-1">
                  <Input
                    placeholder="Search description, account, category..."
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Account Filter */}
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account._id} value={account._id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {filteredCategoriesForDropdown.map((category) => (
                      <SelectItem key={category._id} value={category._id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type and Kind Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Transaction Type Filter */}
                <div className="flex-1">
                  <Label className="text-sm font-medium">Transaction Type</Label>
                  <RadioGroup
                    value={selectedType}
                    onValueChange={setSelectedType}
                    className="flex items-center space-x-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="type-all" />
                      <Label htmlFor="type-all">All</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="income" id="type-income" />
                      <Label htmlFor="type-income">Income</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="expense" id="type-expense" />
                      <Label htmlFor="type-expense">Expense</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Transaction Kind Filter */}
                <div className="flex-1">
                  <Label className="text-sm font-medium">Kind</Label>
                  <RadioGroup
                    value={selectedTransactionKind}
                    onValueChange={setSelectedTransactionKind}
                    className="flex items-center space-x-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="kind-all" />
                      <Label htmlFor="kind-all">All</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="transaction" id="kind-transaction" />
                      <Label htmlFor="kind-transaction">Transactions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="transfer" id="kind-transfer" />
                      <Label htmlFor="kind-transfer">Transfers</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Advanced Filters */}
              <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters} className="mt-4">
                <CollapsibleContent>
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Date Range */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Date From</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn("w-full justify-start text-left font-normal",
                                !dateFrom && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateFrom}
                              onSelect={setDateFrom}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Date To</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn("w-full justify-start text-left font-normal",
                                !dateTo && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, "MMM dd, yyyy") : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateTo}
                              onSelect={setDateTo}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Amount Range */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Amount Min</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={amountMin}
                          onChange={(e) => setAmountMin(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Amount Max</label>
                        <Input
                          type="number"
                          placeholder="999999.99"
                          value={amountMax}
                          onChange={(e) => setAmountMax(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Transactions List */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>
                All Transactions ({filteredAndSortedTransactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(10)].map((_, i) => (
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
              ) : filteredAndSortedTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                    <i className="fas fa-receipt text-muted-foreground text-xl" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">
                    {searchTerm || selectedAccount !== "all" || selectedCategory !== "all" || selectedType !== "all" || selectedTransactionKind !== "all"
                      ? "No transactions match your filters"
                      : "No transactions yet"}
                  </p>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || selectedAccount !== "all" || selectedCategory !== "all" || selectedType !== "all" || selectedTransactionKind !== "all"
                      ? "Try adjusting your search or filter criteria"
                      : "Add your first transaction to get started"}
                  </p>
                  <Button
                    onClick={() => setShowAddTransaction(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Transaction
                  </Button>
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-border">
                  {filteredAndSortedTransactions.map((transaction) => (
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
                                {transaction.category.name} • {transaction.account.name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-medium ${getTransactionTypeColor(transaction.type)}`}>
                                {transaction.type === 'income' ? '+' : '-'}
                                {formatCurrency(transaction.amount)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDateFull(transaction.date)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTransaction(transaction._id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        open={showAddTransaction}
        onOpenChange={setShowAddTransaction}
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
      />

      {/* Transfer Modal */}
      <TransferModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteTransaction !== null} onOpenChange={() => setDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction
              and update your account balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTransaction && handleDelete(Number(deleteTransaction))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

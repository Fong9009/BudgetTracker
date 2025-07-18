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
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, formatDateFull, getTransactionTypeColor, debounce, cn, groupTransferTransactions, type TransactionOrTransfer } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit2, Trash2, Download, Calendar as CalendarIcon, Filter, ChevronDown, X, SlidersHorizontal, ArrowRightLeft, Clock, TrendingUp, Zap } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
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
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: "Transaction deleted successfully",
        variant: "success",
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

  // Group transfers and filter/sort all transactions
  const filteredAndSortedTransactions = useMemo(() => {
    // First group the transfer transactions
    const groupedTransactions = groupTransferTransactions(transactions);
    
    // Then filter the grouped transactions
    let filtered = groupedTransactions.filter((item) => {
      // Text search (description, account name, category name)
      const searchText = searchTerm.toLowerCase();
      let matchesSearch = false;
      
      if (!searchText) {
        matchesSearch = true;
      } else if (item.type === 'transfer') {
        // For transfers, search in description and both account names
        matchesSearch = item.description.toLowerCase().includes(searchText) ||
          item.fromAccount!.name.toLowerCase().includes(searchText) ||
          item.toAccount!.name.toLowerCase().includes(searchText) ||
          item.category.name.toLowerCase().includes(searchText);
      } else {
        // For regular transactions
        matchesSearch = item.description.toLowerCase().includes(searchText) ||
          item.account.name.toLowerCase().includes(searchText) ||
          item.category.name.toLowerCase().includes(searchText);
      }
      
      // Filter by account - for transfers, match either from or to account
      let matchesAccount = false;
      if (selectedAccount === "all") {
        matchesAccount = true;
      } else if (item.type === 'transfer') {
        matchesAccount = item.fromAccount!._id === selectedAccount || item.toAccount!._id === selectedAccount;
      } else {
        matchesAccount = item.accountId === selectedAccount;
      }
      
      // Filter by category
      const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory;
      
      // Filter by type - only applies to regular transactions (not transfers)
      const matchesType = selectedType === "all" || 
        (item.type !== "transfer" && item.type === selectedType);
      
      // Filter by transaction kind
      const matchesKind = selectedTransactionKind === "all" ||
        (selectedTransactionKind === "transfer" && item.type === "transfer") ||
        (selectedTransactionKind === "transaction" && item.type !== "transfer");
      
      // Filter by date range
      const transactionDate = new Date(item.date);
      const matchesDateFrom = !dateFrom || transactionDate >= dateFrom;
      const matchesDateTo = !dateTo || transactionDate <= dateTo;
      
      // Filter by amount range
      const amount = Math.abs(item.amount);
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
          if (a.type === 'transfer' && b.type === 'transfer') {
            comparison = a.fromAccount!.name.localeCompare(b.fromAccount!.name);
          } else if (a.type === 'transfer') {
            comparison = a.fromAccount!.name.localeCompare(b.account.name);
          } else if (b.type === 'transfer') {
            comparison = a.account.name.localeCompare(b.fromAccount!.name);
          } else {
            comparison = a.account.name.localeCompare(b.account.name);
          }
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

  // Quick filter presets
  const applyQuickFilter = (preset: string) => {
    clearAllFilters();
    const now = new Date();
    
    switch (preset) {
      case "today":
        setDateFrom(startOfDay(now));
        setDateTo(endOfDay(now));
        break;
      case "this-week":
        setDateFrom(startOfWeek(now));
        setDateTo(endOfWeek(now));
        break;
      case "this-month":
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
      case "last-30-days":
        setDateFrom(subDays(now, 30));
        setDateTo(now);
        break;
      case "last-month":
        const lastMonth = subMonths(now, 1);
        setDateFrom(startOfMonth(lastMonth));
        setDateTo(endOfMonth(lastMonth));
        break;
      case "high-amounts":
        setAmountMin("500");
        setSortBy("amount");
        setSortOrder("desc");
        break;
      case "recent-transfers":
        setSelectedTransactionKind("transfer");
        setDateFrom(subDays(now, 7));
        setSortBy("date");
        setSortOrder("desc");
        break;
      case "income-only":
        setSelectedType("income");
        setSelectedTransactionKind("transaction");
        setSortBy("amount");
        setSortOrder("desc");
        break;
      case "expenses-only":
        setSelectedType("expense");
        setSelectedTransactionKind("transaction");
        setSortBy("amount");
        setSortOrder("desc");
        break;
    }
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || selectedAccount !== "all" || selectedCategory !== "all" || 
    selectedType !== "all" || selectedTransactionKind !== "all" || dateFrom || dateTo || amountMin || amountMax;

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedAccount !== "all") count++;
    if (selectedCategory !== "all") count++;
    if (selectedType !== "all") count++;
    if (selectedTransactionKind !== "all") count++;
    if (dateFrom || dateTo) count++;
    if (amountMin || amountMax) count++;
    return count;
  };

  const handleDelete = (id: string) => {
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
                    <Badge variant="secondary" className="ml-2">
                      {filteredAndSortedTransactions.length} results
                    </Badge>
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
                    {getActiveFilterCount() > 0 && (
                      <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {getActiveFilterCount()}
                      </Badge>
                    )}
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
              {/* Quick Filter Presets */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-medium">Quick Filters</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter("today")}
                    className="h-8 text-xs"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter("this-week")}
                    className="h-8 text-xs"
                  >
                    This Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter("this-month")}
                    className="h-8 text-xs"
                  >
                    This Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter("last-30-days")}
                    className="h-8 text-xs"
                  >
                    Last 30 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter("last-month")}
                    className="h-8 text-xs"
                  >
                    Last Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter("high-amounts")}
                    className="h-8 text-xs"
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    High Amounts
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter("recent-transfers")}
                    className="h-8 text-xs"
                  >
                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                    Recent Transfers
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter("income-only")}
                    className="h-8 text-xs text-green-600 hover:text-green-700"
                  >
                    Income Only
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFilter("expenses-only")}
                    className="h-8 text-xs text-red-600 hover:text-red-700"
                  >
                    Expenses Only
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Enhanced Search Input */}
                <div className="lg:col-span-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search description, account, category..."
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                        if (input) input.value = "";
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
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

              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Active Filters:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchTerm && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Search className="h-3 w-3" />
                        Search: "{searchTerm}"
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                            if (input) input.value = "";
                          }}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedAccount !== "all" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Account: {accounts.find(a => a._id === selectedAccount)?.name}
                        <button
                          onClick={() => setSelectedAccount("all")}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedCategory !== "all" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Category: {categories.find(c => c._id === selectedCategory)?.name}
                        <button
                          onClick={() => setSelectedCategory("all")}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedType !== "all" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Type: {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
                        <button
                          onClick={() => setSelectedType("all")}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedTransactionKind !== "all" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Show: {selectedTransactionKind === "transaction" ? "Transactions only" : "Transfers only"}
                        <button
                          onClick={() => setSelectedTransactionKind("all")}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {(dateFrom || dateTo) && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {dateFrom && dateTo 
                          ? `${format(dateFrom, "MMM dd")} - ${format(dateTo, "MMM dd")}`
                          : dateFrom 
                          ? `From ${format(dateFrom, "MMM dd")}`
                          : `Until ${format(dateTo!, "MMM dd")}`
                        }
                        <button
                          onClick={() => {
                            setDateFrom(undefined);
                            setDateTo(undefined);
                          }}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {(amountMin || amountMax) && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {amountMin && amountMax 
                          ? `$${amountMin} - $${amountMax}`
                          : amountMin 
                          ? `Min $${amountMin}`
                          : `Max $${amountMax}`
                        }
                        <button
                          onClick={() => {
                            setAmountMin("");
                            setAmountMax("");
                          }}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Type and Kind Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Transaction Type Filter - Only for regular transactions */}
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

                {/* Show/Hide Filter */}
                <div className="flex-1">
                  <Label className="text-sm font-medium">Show</Label>
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
                  <div className="border-t border-border pt-4 mt-4 space-y-6">
                    {/* Date Range with Quick Buttons */}
                    <div>
                      <h5 className="text-sm font-medium mb-3">Date Range</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">From</label>
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
                          <label className="text-sm font-medium text-muted-foreground">To</label>
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
                      </div>
                      {(dateFrom || dateTo) && (
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDateFrom(undefined);
                              setDateTo(undefined);
                            }}
                            className="h-6 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear dates
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Amount Range */}
                    <div>
                      <h5 className="text-sm font-medium mb-3">Amount Range</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Minimum</label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={amountMin}
                            onChange={(e) => setAmountMin(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Maximum</label>
                          <Input
                            type="number"
                            placeholder="999999.99"
                            value={amountMax}
                            onChange={(e) => setAmountMax(e.target.value)}
                          />
                        </div>
                      </div>
                      {(amountMin || amountMax) && (
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAmountMin("");
                              setAmountMax("");
                            }}
                            className="h-6 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear amounts
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Sorting */}
                    <div>
                      <h5 className="text-sm font-medium mb-3">Sort Results</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Sort by</label>
                          <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="amount">Amount</SelectItem>
                              <SelectItem value="description">Description</SelectItem>
                              <SelectItem value="account">Account</SelectItem>
                              <SelectItem value="category">Category</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Order</label>
                          <Select value={sortOrder} onValueChange={setSortOrder}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="desc">Newest first</SelectItem>
                              <SelectItem value="asc">Oldest first</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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
                  {filteredAndSortedTransactions.map((item) => (
                    <div key={item._id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center flex-1">
                        <div className="flex-shrink-0">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: item.category.color, color: 'white' }}
                          >
                            {item.type === 'transfer' ? (
                              <ArrowRightLeft className="h-5 w-5" />
                            ) : (
                              <i className={`${item.category.icon} text-sm`} />
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {item.type === 'transfer' 
                                  ? `Transfer: ${item.description}`
                                  : item.description
                                }
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {item.type === 'transfer' 
                                  ? `${item.fromAccount!.name} → ${item.toAccount!.name}`
                                  : `${item.category.name} • ${item.account.name}`
                                }
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-medium ${
                                item.type === 'transfer' 
                                  ? 'text-foreground'
                                  : getTransactionTypeColor(item.type)
                              }`}>
                                {item.type === 'transfer' 
                                  ? formatCurrency(item.amount)
                                  : `${item.type === 'income' ? '+' : '-'}${formatCurrency(item.amount)}`
                                }
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDateFull(item.date)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex space-x-2">
                          {item.type !== 'transfer' && (
                            <Button variant="ghost" size="sm">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTransaction(
                              item.type === 'transfer' 
                                ? item.fromTransactionId! 
                                : item._id
                            )}
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
              onClick={() => deleteTransaction && handleDelete(deleteTransaction)}
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

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
import { AddCategoryModal } from "@/components/modals/add-category-modal";
import { EditCategoryModal } from "@/components/modals/edit-category-modal";
import { SortableGrid } from "@/components/ui/sortable-grid";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, getTransactionTypeColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getValidToken } from "@/lib/queryClient";
import { Plus, Edit2, Trash2, Archive, X, Receipt } from "lucide-react";
import { useLocation } from "wouter";
import type { Category, TransactionWithDetails } from "@shared/schema";

export default function Categories() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [archiveCategory, setArchiveCategory] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [viewingCategoryTransactions, setViewingCategoryTransactions] = useState<Category | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: categoriesWithCounts = [], isLoading } = useQuery<(Category & { transactionCount: number })[]>({
    queryKey: ["/api/categories/with-counts"],
    enabled: isAuthenticated && !authLoading,
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) return [];
      
      try {
        const response = await fetch("/api/categories/with-counts", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        
        if (response.status === 401) return [];
        if (!response.ok) throw new Error("Failed to fetch categories with transaction counts");
        
        return response.json();
      } catch (error) {
        console.error("Error fetching categories with transaction counts:", error);
        return [];
      }
    },
  });

  const { data: categoryTransactions = [], isLoading: transactionsLoading } = useQuery<TransactionWithDetails[]>({
    queryKey: ["/api/transactions", viewingCategoryTransactions?._id],
    enabled: isAuthenticated && !authLoading && !!viewingCategoryTransactions,
    queryFn: async () => {
      const token = await getValidToken();
      if (!token || !viewingCategoryTransactions) return [];
      
      try {
        const response = await fetch(`/api/transactions?categoryId=${viewingCategoryTransactions._id}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        
        if (response.status === 401) return [];
        if (!response.ok) throw new Error("Failed to fetch category transactions");
        
        const data = await response.json();
        return data.transactions || [];
      } catch (error) {
        console.error("Error fetching category transactions:", error);
        return [];
      }
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      console.log("Category deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/with-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: "Category archived successfully. You can restore it from the archive if needed.",
        variant: "success",
      });
      setArchiveCategory(null);
    },
    onError: (error: any) => {
      console.error("Category deletion error:", error);
      const errorMessage = error.message || "Failed to archive category";
      toast({
        title: "Cannot Archive Category",
        description: errorMessage,
        variant: "destructive",
      });
      setArchiveCategory(null);
    },
  });

  const filteredCategories = categoriesWithCounts.filter(c => c.name !== 'Transfer');

  const handleArchive = (id: string) => {
    archiveMutation.mutate(id);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setShowEditCategory(true);
  };

  const handleViewTransactions = (category: Category) => {
    setViewingCategoryTransactions(category);
  };

  const handleCloseTransactions = () => {
    setViewingCategoryTransactions(null);
  };

  const handleReorder = (newOrder: (Category & { transactionCount: number })[]) => {
    setCategoryOrder(newOrder.map(category => category._id));
    localStorage.setItem('categoryOrder', JSON.stringify(newOrder.map(category => category._id)));
  };

  // Sort categories based on saved order or default order
  const sortedCategories = React.useMemo(() => {
    if (categoryOrder.length > 0) {
      const orderMap = new Map(categoryOrder.map((id, index) => [id, index]));
      return [...filteredCategories].sort((a, b) => {
        const aIndex = orderMap.get(a._id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = orderMap.get(b._id) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      });
    }
    return filteredCategories;
  }, [filteredCategories, categoryOrder]);

  // Load saved order on mount
  React.useEffect(() => {
    const savedOrder = localStorage.getItem('categoryOrder');
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        // Validate that the saved order contains valid IDs
        if (Array.isArray(parsedOrder) && parsedOrder.every(id => typeof id === 'string')) {
          setCategoryOrder(parsedOrder);
        } else {
          console.warn('Invalid category order found in localStorage, clearing it');
          localStorage.removeItem('categoryOrder');
        }
      } catch (error) {
        console.error('Failed to parse saved category order:', error);
        localStorage.removeItem('categoryOrder');
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
                Categories
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Organize your transactions with custom categories
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4 space-x-2">
              <Button
                variant="outline"
                onClick={() => setLocation("/categories/archived")}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                View Archive
              </Button>
              <Button
                onClick={() => setShowAddCategory(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="mt-8">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-muted rounded-lg mr-4" />
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-24" />
                          <div className="h-3 bg-muted rounded w-16" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <i className="fas fa-folder text-muted-foreground text-xl" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">
                  No categories yet
                </p>
                <p className="text-muted-foreground mb-4">
                  Create your first category to organize your transactions
                </p>
                <Button
                  onClick={() => setShowAddCategory(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </div>
            ) : (
              <SortableGrid
                items={sortedCategories}
                onReorder={handleReorder}
                className="sm:grid-cols-2 lg:grid-cols-3"
                getId={(category) => category._id}
              >
                {(category) => (
                  <Card className="group relative">
                    <CardContent className="p-4 relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center mr-4"
                            style={{ backgroundColor: category.color }}
                          >
                            <i className={`${category.icon} text-white text-lg`} />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{category.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {category.transactionCount} Transaction{category.transactionCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-border space-y-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewTransactions(category)}
                          className="w-full"
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          View Transactions
                        </Button>
                        
                        <div className="flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(category)}
                            className="flex-1"
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 text-red-500 hover:text-red-600"
                            onClick={() => setArchiveCategory(category._id)}
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

          {/* Category Stats */}
          {filteredCategories.length > 0 && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Category Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {filteredCategories.length}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total Categories
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {filteredCategories.filter(category => category.transactionCount > 0).length}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Active This Month
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {filteredCategories.reduce((sum, category) => sum + category.transactionCount, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total Transactions
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Category Transactions View */}
          {viewingCategoryTransactions && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      {viewingCategoryTransactions.name} - Transactions
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
                  ) : categoryTransactions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No transactions found for this category.</p>
                    </div>
                  ) : (
                    <div className="space-y-0 divide-y divide-border">
                      {categoryTransactions.map((transaction) => (
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
                                    {transaction.account.name}
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
      </div>

      {/* Modals */}
      <AddCategoryModal
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
      />
      <EditCategoryModal
        open={showEditCategory}
        onOpenChange={setShowEditCategory}
        category={selectedCategory}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveCategory !== null} onOpenChange={() => setArchiveCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Category</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the category and reassign any active transactions to an "Uncategorized" category. You can restore it later from the archived categories page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveCategory && handleArchive(archiveCategory)}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

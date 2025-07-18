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
import { AddCategoryModal } from "@/components/modals/add-category-modal";
import { EditCategoryModal } from "@/components/modals/edit-category-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Archive } from "lucide-react";
import { useLocation } from "wouter";
import type { Category } from "@shared/schema";

export default function Categories() {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("Deleting category with ID:", id);
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      console.log("Category deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/archived"] });
      toast({
        title: "Success",
        description: "Category archived successfully. You can restore it from the archive if needed.",
        variant: "success",
      });
      setDeleteCategory(null);
    },
    onError: (error: any) => {
      console.error("Category deletion error:", error);
      const errorMessage = error.message || "Failed to archive category";
      toast({
        title: "Cannot Archive Category",
        description: errorMessage,
        variant: "destructive",
      });
      setDeleteCategory(null);
    },
  });

  const filteredCategories = categories.filter(c => c.name !== 'Transfer');

  const handleDelete = (id: string) => {
    console.log("handleDelete called with ID:", id);
    deleteMutation.mutate(id);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setShowEditCategory(true);
  };

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCategories.map((category) => (
                  <Card key={category._id} className="group relative">
                    <CardContent className="p-4 flex items-center justify-between">
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
                            {/* Placeholder for transaction count */}
                            0 Transactions
                          </p>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(category)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setDeleteCategory(category._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
                        0
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Active This Month
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        0
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
      <AlertDialog open={deleteCategory !== null} onOpenChange={() => setDeleteCategory(null)}>
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
              onClick={() => deleteCategory && handleDelete(deleteCategory)}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {deleteMutation.isPending ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

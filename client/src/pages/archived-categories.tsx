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
import { getValidToken } from "@/lib/queryClient";
import { RotateCcw, Trash2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import type { Category } from "@shared/schema";

export default function ArchivedCategories() {
  const [restoreCategory, setRestoreCategory] = useState<string | null>(null);
  const [restoreAllCategories, setRestoreAllCategories] = useState(false);
  const [deleteAllCategories, setDeleteAllCategories] = useState(false);
  const [permanentDeleteCategory, setPermanentDeleteCategory] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: archivedCategories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories/archived"],
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) return [];
      
      try {
        const response = await fetch("/api/categories/archived", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        
        if (response.status === 401) return [];
        if (!response.ok) throw new Error("Failed to fetch archived categories");
        
        return response.json();
      } catch (error) {
        console.error("Error fetching archived categories:", error);
        return [];
      }
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/categories/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/with-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: "Category restored successfully",
        variant: "success",
      });
      setRestoreCategory(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore category",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/categories/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/archived"] });
      toast({
        title: "Success",
        description: "Category permanently deleted",
        variant: "success",
      });
      setPermanentDeleteCategory(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to permanently delete category",
        variant: "destructive",
      });
    },
  });

  const restoreAllMutation = useMutation({
    mutationFn: async () => {
      const categoryIds = archivedCategories.map(category => category._id);
      await apiRequest("POST", "/api/categories/restore-all", { categoryIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/with-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: `All ${archivedCategories.length} categories restored successfully`,
        variant: "success",
      });
      setRestoreAllCategories(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore all categories",
        variant: "destructive",
      });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const categoryIds = archivedCategories.map(category => category._id);
      await apiRequest("DELETE", "/api/categories/delete-all", { categoryIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: `All ${archivedCategories.length} categories permanently deleted`,
        variant: "success",
      });
      setDeleteAllCategories(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete all categories",
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

  const handleRestoreAll = () => {
    restoreAllMutation.mutate();
  };

  const handleDeleteAll = () => {
    deleteAllMutation.mutate();
  };

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
                onClick={() => setLocation("/categories")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Categories
              </Button>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Archived Categories
                </h2>
                <p className="text-sm text-muted-foreground">
                  Restore or permanently delete archived categories
                </p>
              </div>
            </div>
            {archivedCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRestoreAllCategories(true)}
                  className="flex items-center gap-2 text-green-600 hover:text-green-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore All ({archivedCategories.length})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteAllCategories(true)}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete All ({archivedCategories.length})
                </Button>
              </div>
            )}
          </div>

          {/* Archived Categories Grid */}
          <div className="mt-8">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-muted rounded-lg mr-4" />
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-24" />
                            <div className="h-3 bg-muted rounded w-20" />
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
            ) : archivedCategories.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                    <i className="fas fa-archive text-muted-foreground text-xl" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">
                    No archived categories
                  </p>
                  <p className="text-muted-foreground">
                    Deleted categories will appear here for recovery
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedCategories.map((category) => (
                  <Card key={category._id} className="border-destructive/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center opacity-60`} style={{ backgroundColor: category.color }}>
                              <i className={`${category.icon} text-white text-sm`} />
                            </div>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-foreground">
                              {category.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Category
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRestoreCategory(category._id)}
                          className="flex-1 text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPermanentDeleteCategory(category._id)}
                          className="flex-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
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
      <AlertDialog open={restoreCategory !== null} onOpenChange={() => setRestoreCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this category? It will be moved back to your active categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreCategory && handleRestore(restoreCategory)}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {restoreMutation.isPending ? "Restoring..." : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={permanentDeleteCategory !== null} onOpenChange={() => setPermanentDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this category? This action cannot be undone.
              Note: You cannot delete a category that has associated transactions. Please permanently delete all transactions associated with this category first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => permanentDeleteCategory && handlePermanentDelete(permanentDeleteCategory)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {permanentDeleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore All Confirmation Dialog */}
      <AlertDialog open={restoreAllCategories} onOpenChange={setRestoreAllCategories}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore all categories?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore all {archivedCategories.length} archived categories. 
              They will be moved back to your active categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreAll}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {restoreAllMutation.isPending ? "Restoring..." : "Restore All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={deleteAllCategories} onOpenChange={setDeleteAllCategories}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete all categories?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {archivedCategories.length} archived categories. 
              This action cannot be undone and the data will be lost forever.
              Note: You cannot delete categories that have associated transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAllMutation.isPending ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 